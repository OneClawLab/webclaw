// ── 客户端 → 服务端 ──

export interface HelloFrame {
  type: 'hello'
  channel_id: string
  peer_id: string
}

export interface OpenConversationFrame {
  type: 'open_conversation'
  conversation_id: string
  agent_id: string
}

export interface CloseConversationFrame {
  type: 'close_conversation'
  conversation_id: string
}

export interface MessageFrame {
  type: 'message'
  conversation_id: string
  text: string
}

export interface PingFrame {
  type: 'ping'
}

// ── 服务端 → 客户端 ──

export interface HelloAckFrame {
  type: 'hello_ack'
  channel_id: string
  peer_id: string
  agents?: string[]
}

export interface ErrorFrame {
  type: 'error'
  code: string
  message: string
  conversation_id?: string
}

export interface StreamChunkFrame {
  type: 'stream_chunk'
  conversation_id: string
  text: string
}

export interface StreamEndFrame {
  type: 'stream_end'
  conversation_id: string
}

export interface ProgressFrame {
  type: 'progress'
  conversation_id: string
  kind: 'thinking' | 'tool_call' | 'tool_result' | 'ctx_usage' | 'compact_start' | 'compact_end'
  text: string
}

export interface PongFrame {
  type: 'pong'
}

export type ClientFrame =
  | HelloFrame
  | OpenConversationFrame
  | CloseConversationFrame
  | MessageFrame
  | PingFrame

export type ServerFrame =
  | HelloAckFrame
  | ErrorFrame
  | StreamChunkFrame
  | StreamEndFrame
  | ProgressFrame
  | PongFrame

export type WebUIFrame = ClientFrame | ServerFrame
