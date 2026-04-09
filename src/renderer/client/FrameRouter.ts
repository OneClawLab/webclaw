/**
 * FrameRouter — 全局持久 xgw frame 分发器
 *
 * 职责：
 *   1. app 启动时注册一个永久 onFrame listener
 *   2. streamChat 进行中时，将该 conversationId 的帧优先转发给 streamChat 的 handler
 *   3. streamChat 结束后，若 agent 继续主动推帧（orchestrator 子任务回调等），
 *      自动找到对应 doc/tab，创建 writers 写入文档
 *   4. 完全陌生的 conversationId → toast 通知用户
 */

import { Logger } from '@lib/logast.js'
import { DocAppender } from '@editor/DocAppender.js'
import { theDocManager } from '@editor/DocManager.js'
import { getState, getAppDispatch } from '@state/storeHolder.js'
import { tabActions } from '@state/slices/tab/slice.js'
import { docActions } from '@state/slices/doc/slice.js'
import { toast } from '@lib/renderer/dialog.js'
import { emitAppEvent } from '@event/app.js'
import type { ServerFrame, ProgressFrame } from '@lib/webui-protocol/index.js'
import type { EditorSectionWriter } from '@editor/DocAppender.js'
import type { CtxUsage } from '@state/slices/doc/types.js'
import { formatProgress } from './progressFormat.js'

// ── Types ─────────────────────────────────────────────────────────────────────

/** streamChat 注册的活跃会话 handler */
export type ActiveSessionHandler = (frame: ServerFrame) => Promise<void>

/** 自动创建的被动会话（agent 主动推送时） */
interface PassiveSession {
  tabId: string
  writers: { output: EditorSectionWriter; progress?: EditorSectionWriter }
  /** 收到 stream_end 或 error 后清理 */
  cleanup: () => void
}

// ── FrameRouter ───────────────────────────────────────────────────────────────

class FrameRouter {
  /** conversationId → streamChat 的 handler（优先级最高） */
  private activeSessions = new Map<string, ActiveSessionHandler>()

  /** conversationId → 被动会话（agent 主动推送时动态创建） */
  private passiveSessions = new Map<string, PassiveSession>()

  private initialized = false

  /** app 启动时调用一次 */
  init(): void {
    if (this.initialized) return
    this.initialized = true

    const xgw = (window as any).xgw
    if (!xgw) {
      Logger.warn('FrameRouter', 'window.xgw not available, frame routing disabled')
      return
    }

    // 永久监听，不 unsubscribe
    xgw.onFrame((frame: ServerFrame) => {
      void this._route(frame)
    })

    Logger.info('FrameRouter', 'initialized')
  }

  // ── Active session registration (used by streamChat) ──────────────────────

  register(conversationId: string, handler: ActiveSessionHandler): void {
    this.activeSessions.set(conversationId, handler)
  }

  unregister(conversationId: string): void {
    this.activeSessions.delete(conversationId)
  }

  // ── Routing ───────────────────────────────────────────────────────────────

  private async _route(frame: ServerFrame): Promise<void> {
    // 提取 conversation_id（pong / hello_ack 没有）
    const convId = 'conversation_id' in frame ? frame.conversation_id : undefined
    if (!convId) return

    // 1. 优先转发给 streamChat 的 active handler
    const activeHandler = this.activeSessions.get(convId)
    if (activeHandler) {
      await activeHandler(frame)
      return
    }

    // 2. 转发给已有的 passive session
    const passive = this.passiveSessions.get(convId)
    if (passive) {
      await this._writeToPassive(passive, convId, frame)
      return
    }

    // 3. 尝试找到对应的 doc/tab，动态创建 passive session
    const session = await this._createPassiveSession(convId)
    if (session) {
      this.passiveSessions.set(convId, session)
      await this._writeToPassive(session, convId, frame)
      return
    }

    // 4. 完全陌生的 conversationId — 只处理 ctx_usage / compact，其余 toast 通知
    if (frame.type === 'progress') {
      const pf = frame as ProgressFrame
      if (pf.kind === 'ctx_usage') { this._handleCtxUsage(pf); return }
      if (pf.kind === 'compact_start' || pf.kind === 'compact_end') {
        this._handleCompact(pf); return
      }
    }

    if (frame.type === 'stream_chunk' || frame.type === 'stream_end') {
      Logger.warn('FrameRouter', `Received frame for unknown conversation: ${convId}`)
      toast.show(`收到未知会话的消息 (${convId.slice(0, 20)}…)`, 'warn')
    }
  }

  private async _writeToPassive(session: PassiveSession, convId: string, frame: ServerFrame): Promise<void> {
    try {
      if (frame.type === 'stream_chunk') {
        await session.writers.output.write(frame.text)
      } else if (frame.type === 'stream_end') {
        await session.writers.output.finalize('ok')
        if (session.writers.progress) await session.writers.progress.finalize('ok')
        session.cleanup()
        this.passiveSessions.delete(convId)
      } else if (frame.type === 'progress') {
        const pf = frame as ProgressFrame
        if (pf.kind === 'ctx_usage') { this._handleCtxUsage(pf); return }
        if (pf.kind === 'compact_start' || pf.kind === 'compact_end') { this._handleCompact(pf); return }
        const line = formatProgress(pf)
        if (line !== null && session.writers.progress) {
          await session.writers.progress.write(line + '\n')
        }
      } else if (frame.type === 'error') {
        const errMsg = frame.message
        if (session.writers.progress) {
          await session.writers.progress.write(`> **Error:** ${errMsg}\n`)
          await session.writers.progress.finalize('fail', errMsg)
        }
        await session.writers.output.finalize('fail', errMsg)
        session.cleanup()
        this.passiveSessions.delete(convId)
      }
    } catch (err) {
      Logger.error('FrameRouter', 'Error writing to passive session:', err)
    }
  }

  /** 根据 conversationId 找到对应 doc/tab，创建 passive session */
  private async _createPassiveSession(convId: string): Promise<PassiveSession | null> {
    const state = getState()
    const dispatch = getAppDispatch()

    // 找到 conversationId 对应的 docId
    const docId = Object.keys(state.doc.docs).find(
      id => state.doc.docs[id]?.conversationId === convId
    )
    if (!docId) return null

    // 找到该 doc 对应的第一个 tab
    const tab = state.tab.tabs.find(t => t.docId === docId)
    if (!tab) return null

    // 找到对应的 EditorView
    const view = theDocManager.getEditorView(tab.id)
    if (!view) return null

    Logger.info('FrameRouter', `Creating passive session for conv=${convId} tab=${tab.id}`)

    // 设置 tab 为 editing + autoScroll 状态
    dispatch(tabActions.markTabEditing({ tabId: tab.id, editing: true }))
    DocAppender.autoScroll(tab.id, true)

    // 插入 answer chat section header
    DocAppender.beginChatSection(view, 'answer', false, false)

    // 创建 writers
    const progressMode = state.settings.progressMode
    const writers = await DocAppender.writer2(view, progressMode === 'verbose')

    const cleanup = () => {
      DocAppender.endChatSection(view)
      DocAppender.autoScroll(tab.id, false)
      dispatch(tabActions.markTabEditing({ tabId: tab.id, editing: false }))
      // 插入空的 question section 方便用户继续
      DocAppender.beginChatSection(view, 'question', false, false)
    }

    return { tabId: tab.id, writers, cleanup }
  }

  private _handleCtxUsage(pf: ProgressFrame): void {
    try {
      const u = JSON.parse(pf.text) as CtxUsage
      getAppDispatch()(docActions.setCtxUsageByConversationId({
        conversationId: pf.conversation_id,
        ctxUsage: u,
      }))
    } catch { /* ignore malformed */ }
  }

  private _handleCompact(pf: ProgressFrame): void {
    try {
      if (pf.kind === 'compact_start') {
        const info = JSON.parse(pf.text) as { reason: string }
        emitAppEvent('xgw:compact_start', { reason: info.reason ?? '' })
      } else if (pf.kind === 'compact_end') {
        const info = JSON.parse(pf.text) as { before_tokens: number; after_tokens: number }
        emitAppEvent('xgw:compact_end', { before_tokens: info.before_tokens, after_tokens: info.after_tokens })
      }
    } catch { /* ignore malformed */ }
  }
}

export const theFrameRouter = new FrameRouter()
