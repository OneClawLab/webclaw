import { Logger } from "@lib/logast.js"
import type { UserPrompt } from "@ai/common/Prompt.js";
import { EditorSectionWriter } from "@editor/DocAppender.js";
import { getState, getAppDispatch } from "@state/storeHolder.js";
import { docActions } from "@state/slices/doc/slice.js";
import type { CtxUsage } from "@state/slices/doc/types.js";
import type { ServerFrame, ProgressFrame } from "@lib/webui-protocol/index.js";
import { formatProgress } from './progressFormat.js'
import { theFrameRouter } from './FrameRouter.js'

export type AiStatus = 'connected' | 'unconfigured' | 'disconnected'

export async function aiStatus(): Promise<AiStatus> {
  const state = getState();
  const status = state.connection.status;
  if (status === 'authenticated') return 'connected';
  if (status === 'disconnected') return 'disconnected';
  return 'unconfigured';
}

export async function listAgents(): Promise<string[]> {
  const state = getState();
  return state.agent.availableAgents;
}

// ── streamChat ────────────────────────────────────────────────────────────────
//
// 注册到 FrameRouter 作为 active session handler，处理当前对话的帧。
// stream_end / error 后注销，FrameRouter 继续监听后续主动推送的帧。

export async function streamChat(
  userId: string,
  sessionId: string,
  agentName: string,
  prompt: UserPrompt,
  writers: {
    output: EditorSectionWriter
    progress?: EditorSectionWriter,
    log?: EditorSectionWriter,
  }
): Promise<void> {
  const conversationId = sessionId;

  return new Promise<void>((resolve, reject) => {
    let done = false;

    const finish = (fn: () => void) => {
      if (done) return;
      done = true;
      theFrameRouter.unregister(conversationId);
      fn();
    };

    const frameHandler = async (frame: ServerFrame) => {
      if (done) return;
      if ('conversation_id' in frame && frame.conversation_id !== conversationId) return;

      try {
        if (frame.type === 'stream_chunk') {
          await writers.output.write(frame.text);
        } else if (frame.type === 'stream_end') {
          await writers.output.finalize('ok');
          if (writers.progress) await writers.progress.finalize('ok');
          finish(resolve);
        } else if (frame.type === 'progress') {
          const pf = frame as ProgressFrame;
          if (pf.kind === 'ctx_usage') {
            try {
              const u = JSON.parse(pf.text) as CtxUsage;
              getAppDispatch()(docActions.setCtxUsageByConversationId({
                conversationId: pf.conversation_id,
                ctxUsage: u,
              }));
            } catch { /* ignore malformed */ }
            return;
          }
          if (pf.kind === 'compact_start' || pf.kind === 'compact_end') return;
          const line = formatProgress(pf);
          if (line !== null && writers.progress) {
            await writers.progress.write(line + '\n');
          }
        } else if (frame.type === 'error') {
          const errMsg = frame.message;
          if (writers.progress) {
            await writers.progress.write(`> **Error:** ${errMsg}\n`);
            await writers.progress.finalize('fail', errMsg);
          }
          await writers.output.finalize('fail', errMsg);
          finish(resolve);
        }
      } catch (err) {
        Logger.error('streamChat', 'Error handling frame:', err);
      }
    };

    // 注册到 FrameRouter（替代直接 onFrame）
    theFrameRouter.register(conversationId, frameHandler);

    window.xgw.sendMessage(conversationId, prompt.text).catch((err: Error) => {
      finish(() => reject(err));
    });
  });
}
