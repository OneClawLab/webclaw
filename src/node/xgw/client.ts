import { EventEmitter } from 'node:events'
import WebSocket from 'ws'
import { parseFrame, serializeFrame } from '@lib/webui-protocol/index.js'
import type { ServerFrame, ClientFrame, MessageFrame } from '@lib/webui-protocol/index.js'

export interface XgwClientConfig {
  host: string
  port: number
  channelId: string
  peerId: string
}

export type XgwClientStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'authenticated'
  | 'reconnecting'

// Conversation entry tracked for re-open after reconnect
interface ConversationEntry {
  conversationId: string
  agentId: string
}

const HEARTBEAT_INTERVAL_MS = 30_000
const MAX_MISSED_PONGS = 3
const MAX_RECONNECT_ATTEMPTS = 10
const MAX_QUEUE_SIZE = 50

/** delay = min(2^(attempt-1) * 1000, 60000) ms */
export function calcBackoffDelay(attempt: number): number {
  return Math.min(Math.pow(2, attempt - 1) * 1000, 60_000)
}

export class XgwClient extends EventEmitter {
  private config: XgwClientConfig
  private ws: WebSocket | null = null
  private _status: XgwClientStatus = 'disconnected'
  private reconnectAttempt = 0
  private intentionalDisconnect = false

  // Track open conversations so they can be re-sent after reconnect
  private openConversations = new Map<string, ConversationEntry>()

  // Offline message queue: buffers MessageFrames when not authenticated
  private messageQueue: MessageFrame[] = []

  // Heartbeat state
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private missedPongs = 0
  private _lastHeartbeat = 0

  constructor(config: XgwClientConfig) {
    super()
    this.config = config
  }

  get status(): XgwClientStatus {
    return this._status
  }

  get lastHeartbeat(): number {
    return this._lastHeartbeat
  }

  connect(): void {
    if (
      this._status === 'connecting' ||
      this._status === 'connected' ||
      this._status === 'authenticated'
    ) {
      return
    }

    this.intentionalDisconnect = false
    this._doConnect()
  }

  disconnect(): void {
    this.intentionalDisconnect = true
    this.reconnectAttempt = 0
    this._stopHeartbeat()
    this._clearReconnectTimer()
    this._setStatus('disconnected')
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  sendMessage(conversationId: string, text: string): void {
    const frame: MessageFrame = { type: 'message', conversation_id: conversationId, text }
    if (this._status !== 'authenticated') {
      if (this.messageQueue.length >= MAX_QUEUE_SIZE) {
        this.messageQueue.shift()
        this.emit('error', 'Offline message queue full, oldest message dropped')
      }
      this.messageQueue.push(frame)
      return
    }
    this._send(frame)
  }

  openConversation(conversationId: string, agentId: string): void {
    this.openConversations.set(conversationId, { conversationId, agentId })
    this._send({ type: 'open_conversation', conversation_id: conversationId, agent_id: agentId })
  }

  closeConversation(conversationId: string): void {
    this.openConversations.delete(conversationId)
    this._send({ type: 'close_conversation', conversation_id: conversationId })
  }

  updateConfig(config: XgwClientConfig): void {
    this.config = config
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private _setStatus(status: XgwClientStatus): void {
    this._status = status
  }

  private _send(frame: ClientFrame): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(serializeFrame(frame))
    }
  }

  private _startHeartbeat(): void {
    this._stopHeartbeat()
    this.missedPongs = 0
    this.heartbeatTimer = setInterval(() => {
      this.missedPongs++
      if (this.missedPongs >= MAX_MISSED_PONGS) {
        // 3 consecutive pings without pong — close and trigger reconnect
        this._stopHeartbeat()
        if (this.ws) {
          this.ws.close()
        }
        return
      }
      this._send({ type: 'ping' })
    }, HEARTBEAT_INTERVAL_MS)
  }

  private _stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private _clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private _doConnect(): void {
    this._setStatus('connecting')

    const url = `ws://${this.config.host}:${this.config.port}`
    const ws = new WebSocket(url)
    this.ws = ws

    ws.on('open', () => {
      this._setStatus('connected')
      this.emit('connected')

      // Send hello frame immediately after connection
      this._send({
        type: 'hello',
        channel_id: this.config.channelId,
        peer_id: this.config.peerId,
      })
    })

    ws.on('message', (data: WebSocket.RawData) => {
      const raw = data.toString()
      const result = parseFrame(raw)
      if (!result.ok) {
        // Log and ignore unparseable frames
        console.warn('[XgwClient] Failed to parse frame:', result.error)
        return
      }

      const frame = result.frame
      this._handleFrame(frame)
    })

    ws.on('close', () => {
      if (this.intentionalDisconnect) {
        return
      }
      this._handleUnexpectedClose()
    })

    ws.on('error', (err: Error) => {
      this.emit('error', err.message)
      // The 'close' event will follow, triggering reconnect logic
    })
  }

  private _handleFrame(frame: ServerFrame): void {
    if (frame.type === 'hello_ack') {
      this._setStatus('authenticated')
      this.reconnectAttempt = 0
      const agents = frame.agents ?? []
      this.emit('authenticated', agents)

      // Start heartbeat now that we're authenticated
      this._startHeartbeat()

      // Re-open all tracked conversations after reconnect
      for (const entry of this.openConversations.values()) {
        this._send({
          type: 'open_conversation',
          conversation_id: entry.conversationId,
          agent_id: entry.agentId,
        })
      }

      // Flush offline message queue in original order
      const queued = this.messageQueue.splice(0)
      for (const frame of queued) {
        this._send(frame)
      }
      return
    }

    if (frame.type === 'pong') {
      this.missedPongs = 0
      this._lastHeartbeat = Date.now()
      return
    }

    // Forward all other frames to listeners
    this.emit('frame', frame)
  }

  private _handleUnexpectedClose(): void {
    this.ws = null
    this._stopHeartbeat()
    this.reconnectAttempt++
    this._setStatus('reconnecting')
    this.emit('reconnecting', this.reconnectAttempt)

    if (this.reconnectAttempt > MAX_RECONNECT_ATTEMPTS) {
      this._setStatus('disconnected')
      this.emit('disconnected')
      this.reconnectAttempt = 0
      return
    }

    const delay = calcBackoffDelay(this.reconnectAttempt)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (!this.intentionalDisconnect) {
        this._doConnect()
      }
    }, delay)
  }
}
