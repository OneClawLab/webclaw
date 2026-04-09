/**
 * Unit tests: webui-protocol frame parser & serializer
 * Pure functions, no I/O, no Electron.
 */
import { describe, it, expect } from 'vitest'
import { parseFrame, serializeFrame } from '../../src/lib/webui-protocol/parser.js'

describe('parseFrame', () => {
  it('parses hello_ack', () => {
    const raw = JSON.stringify({ type: 'hello_ack', channel_id: 'webui:default', peer_id: 'owner', agents: ['admin'] })
    const result = parseFrame(raw)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.frame.type).toBe('hello_ack')
    if (result.frame.type !== 'hello_ack') return
    expect(result.frame.agents).toEqual(['admin'])
  })

  it('parses stream_chunk', () => {
    const raw = JSON.stringify({ type: 'stream_chunk', conversation_id: 'conv-1', text: 'hello' })
    const result = parseFrame(raw)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.frame.type).toBe('stream_chunk')
  })

  it('parses stream_end', () => {
    const raw = JSON.stringify({ type: 'stream_end', conversation_id: 'conv-1' })
    const result = parseFrame(raw)
    expect(result.ok).toBe(true)
  })

  it('parses progress frame', () => {
    const raw = JSON.stringify({ type: 'progress', conversation_id: 'conv-1', kind: 'thinking', text: '' })
    const result = parseFrame(raw)
    expect(result.ok).toBe(true)
  })

  it('parses pong', () => {
    const result = parseFrame(JSON.stringify({ type: 'pong' }))
    expect(result.ok).toBe(true)
  })

  it('rejects invalid JSON', () => {
    const result = parseFrame('not json')
    expect(result.ok).toBe(false)
  })

  it('rejects unknown frame type', () => {
    const result = parseFrame(JSON.stringify({ type: 'unknown_type' }))
    expect(result.ok).toBe(false)
  })

  it('rejects stream_chunk missing text', () => {
    const result = parseFrame(JSON.stringify({ type: 'stream_chunk', conversation_id: 'conv-1' }))
    expect(result.ok).toBe(false)
  })

  it('rejects hello_ack missing peer_id', () => {
    const result = parseFrame(JSON.stringify({ type: 'hello_ack', channel_id: 'webui:default' }))
    expect(result.ok).toBe(false)
  })
})

describe('serializeFrame', () => {
  it('serializes hello frame', () => {
    const frame = { type: 'hello' as const, channel_id: 'webui:default', peer_id: 'owner' }
    const raw = serializeFrame(frame)
    expect(JSON.parse(raw)).toMatchObject(frame)
  })

  it('serializes message frame', () => {
    const frame = { type: 'message' as const, conversation_id: 'conv-1', text: 'hi' }
    const raw = serializeFrame(frame)
    expect(JSON.parse(raw)).toMatchObject(frame)
  })

  it('round-trips open_conversation', () => {
    const frame = { type: 'open_conversation' as const, conversation_id: 'conv-1', agent_id: 'admin' }
    expect(JSON.parse(serializeFrame(frame))).toMatchObject(frame)
  })
})
