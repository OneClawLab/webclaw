import type { ClientFrame, ServerFrame } from './types.js'

export type ParseResult<T> =
  | { ok: true; frame: T }
  | { ok: false; error: string }

const SERVER_FRAME_TYPES = new Set([
  'hello_ack',
  'error',
  'stream_chunk',
  'stream_end',
  'progress',
  'pong',
])

function err(msg: string): ParseResult<never> {
  return { ok: false, error: msg }
}

function requireFields(obj: Record<string, unknown>, fields: string[]): string | null {
  for (const field of fields) {
    if (!(field in obj) || obj[field] === undefined) {
      return field
    }
  }
  return null
}

export function parseFrame(raw: string): ParseResult<ServerFrame> {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return err(`Invalid JSON: ${raw.slice(0, 100)}`)
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return err('Missing field: type')
  }

  const obj = parsed as Record<string, unknown>

  if (!('type' in obj)) {
    return err('Missing field: type')
  }

  const type = obj['type']

  if (typeof type !== 'string') {
    return err('Missing field: type')
  }

  if (!SERVER_FRAME_TYPES.has(type)) {
    return err(`Unknown frame type: ${type}`)
  }

  switch (type) {
    case 'hello_ack': {
      const missing = requireFields(obj, ['channel_id', 'peer_id'])
      if (missing) return err(`Missing field: ${missing}`)
      return { ok: true, frame: obj as unknown as ServerFrame }
    }
    case 'error': {
      const missing = requireFields(obj, ['code', 'message'])
      if (missing) return err(`Missing field: ${missing}`)
      return { ok: true, frame: obj as unknown as ServerFrame }
    }
    case 'stream_chunk': {
      const missing = requireFields(obj, ['conversation_id', 'text'])
      if (missing) return err(`Missing field: ${missing}`)
      return { ok: true, frame: obj as unknown as ServerFrame }
    }
    case 'stream_end': {
      const missing = requireFields(obj, ['conversation_id'])
      if (missing) return err(`Missing field: ${missing}`)
      return { ok: true, frame: obj as unknown as ServerFrame }
    }
    case 'progress': {
      const missing = requireFields(obj, ['conversation_id', 'kind', 'text'])
      if (missing) return err(`Missing field: ${missing}`)
      return { ok: true, frame: obj as unknown as ServerFrame }
    }
    case 'pong': {
      return { ok: true, frame: obj as unknown as ServerFrame }
    }
    default:
      return err(`Unknown frame type: ${type}`)
  }
}

export function serializeFrame(frame: ClientFrame): string {
  return JSON.stringify(frame)
}
