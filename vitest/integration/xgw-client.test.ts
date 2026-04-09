/**
 * Integration tests: XgwClient ↔ mock xgw WebSocket server
 *
 * Spins up a real WebSocketServer on a random port, exercises the full
 * connect → hello → hello_ack → message → stream flow.
 * No Electron, no GUI.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { WebSocketServer, WebSocket } from 'ws'
import { XgwClient } from '../../src/node/xgw/client.js'

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Start a mock xgw WebSocket server on a random port. */
function createMockXgwServer(): Promise<{
  wss: WebSocketServer
  port: number
  /** Last connected client WebSocket (server-side) */
  getClientWs: () => WebSocket | null
  close: () => Promise<void>
}> {
  return new Promise((resolve) => {
    let clientWs: WebSocket | null = null
    const wss = new WebSocketServer({ port: 0 })

    wss.on('connection', (ws) => {
      clientWs = ws
    })

    wss.on('listening', () => {
      const addr = wss.address() as { port: number }
      resolve({
        wss,
        port: addr.port,
        getClientWs: () => clientWs,
        close: () =>
          new Promise((res, rej) => {
            clientWs?.close()
            wss.close((err) => (err ? rej(err) : res()))
          }),
      })
    })
  })
}

/** Wait for an event on an EventEmitter with a timeout. */
function waitForEvent<T = unknown>(
  emitter: { once(event: string, cb: (arg: T) => void): void },
  event: string,
  timeoutMs = 3000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for '${event}'`)), timeoutMs)
    emitter.once(event, (arg: T) => {
      clearTimeout(timer)
      resolve(arg)
    })
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('XgwClient integration', () => {
  let server: Awaited<ReturnType<typeof createMockXgwServer>>
  let client: XgwClient

  beforeEach(async () => {
    server = await createMockXgwServer()
  })

  afterEach(async () => {
    client?.disconnect()
    await server.close()
  })

  it('connects and completes hello handshake', async () => {
    client = new XgwClient({
      host: '127.0.0.1',
      port: server.port,
      channelId: 'webui:default',
      peerId: 'owner',
    })

    // Server: respond to hello with hello_ack
    server.wss.on('connection', (ws) => {
      ws.on('message', (data) => {
        const frame = JSON.parse(data.toString()) as { type: string }
        if (frame.type === 'hello') {
          ws.send(JSON.stringify({
            type: 'hello_ack',
            channel_id: 'webui:default',
            peer_id: 'owner',
            agents: ['admin'],
          }))
        }
      })
    })

    const authenticatedP = waitForEvent<string[]>(client, 'authenticated')
    client.connect()
    const agents = await authenticatedP

    expect(client.status).toBe('authenticated')
    expect(agents).toEqual(['admin'])
  })

  it('queues messages while disconnected and flushes after auth', async () => {
    client = new XgwClient({
      host: '127.0.0.1',
      port: server.port,
      channelId: 'webui:default',
      peerId: 'owner',
    })

    const received: string[] = []

    server.wss.on('connection', (ws) => {
      ws.on('message', (data) => {
        const frame = JSON.parse(data.toString()) as { type: string; text?: string }
        if (frame.type === 'hello') {
          ws.send(JSON.stringify({ type: 'hello_ack', channel_id: 'webui:default', peer_id: 'owner', agents: [] }))
        }
        if (frame.type === 'message') {
          received.push(frame.text ?? '')
        }
      })
    })

    // Queue messages before connecting
    client.sendMessage('conv-1', 'msg-a')
    client.sendMessage('conv-1', 'msg-b')

    const authenticatedP = waitForEvent(client, 'authenticated')
    client.connect()
    await authenticatedP

    // Give a tick for flush
    await new Promise((r) => setTimeout(r, 50))
    expect(received).toEqual(['msg-a', 'msg-b'])
  })

  it('re-opens conversations after reconnect', async () => {
    client = new XgwClient({
      host: '127.0.0.1',
      port: server.port,
      channelId: 'webui:default',
      peerId: 'owner',
    })

    const openConvFrames: string[] = []
    let serverWs: WebSocket | null = null

    server.wss.on('connection', (ws) => {
      serverWs = ws
      ws.on('message', (data) => {
        const frame = JSON.parse(data.toString()) as { type: string; conversation_id?: string }
        if (frame.type === 'hello') {
          ws.send(JSON.stringify({ type: 'hello_ack', channel_id: 'webui:default', peer_id: 'owner', agents: [] }))
        }
        if (frame.type === 'open_conversation') {
          openConvFrames.push(frame.conversation_id ?? '')
        }
      })
    })

    const auth1 = waitForEvent(client, 'authenticated')
    client.connect()
    await auth1

    // Open a conversation
    client.openConversation('conv-1', 'admin')
    await new Promise((r) => setTimeout(r, 30))
    expect(openConvFrames).toContain('conv-1')

    // Force disconnect from server side → triggers reconnect
    openConvFrames.length = 0
    const reconnectingP = waitForEvent(client, 'reconnecting')
    serverWs!.close()
    await reconnectingP

    // Wait for re-auth (client reconnects to same server)
    const auth2 = waitForEvent(client, 'authenticated')
    await auth2

    await new Promise((r) => setTimeout(r, 30))
    // conv-1 should have been re-opened automatically
    expect(openConvFrames).toContain('conv-1')
  })

  it('emits stream frames to listeners', async () => {
    client = new XgwClient({
      host: '127.0.0.1',
      port: server.port,
      channelId: 'webui:default',
      peerId: 'owner',
    })

    server.wss.on('connection', (ws) => {
      ws.on('message', (data) => {
        const frame = JSON.parse(data.toString()) as { type: string }
        if (frame.type === 'hello') {
          ws.send(JSON.stringify({ type: 'hello_ack', channel_id: 'webui:default', peer_id: 'owner', agents: [] }))
          // Push a stream sequence after auth
          setTimeout(() => {
            ws.send(JSON.stringify({ type: 'stream_chunk', conversation_id: 'conv-1', text: 'Hello' }))
            ws.send(JSON.stringify({ type: 'stream_chunk', conversation_id: 'conv-1', text: ' world' }))
            ws.send(JSON.stringify({ type: 'stream_end', conversation_id: 'conv-1' }))
          }, 20)
        }
      })
    })

    const frames: Array<{ type: string }> = []
    client.on('frame', (f) => frames.push(f as { type: string }))

    const auth = waitForEvent(client, 'authenticated')
    client.connect()
    await auth

    // Wait for all 3 frames
    await new Promise((r) => setTimeout(r, 100))
    expect(frames.filter((f) => f.type === 'stream_chunk')).toHaveLength(2)
    expect(frames.filter((f) => f.type === 'stream_end')).toHaveLength(1)
  })

  it('handles heartbeat pong correctly', async () => {
    client = new XgwClient({
      host: '127.0.0.1',
      port: server.port,
      channelId: 'webui:default',
      peerId: 'owner',
    })

    server.wss.on('connection', (ws) => {
      ws.on('message', (data) => {
        const frame = JSON.parse(data.toString()) as { type: string }
        if (frame.type === 'hello') {
          ws.send(JSON.stringify({ type: 'hello_ack', channel_id: 'webui:default', peer_id: 'owner', agents: [] }))
        }
        if (frame.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }))
        }
      })
    })

    const auth = waitForEvent(client, 'authenticated')
    client.connect()
    await auth

    // Manually trigger a ping by sending it directly
    const ws = (client as unknown as { ws: WebSocket }).ws!
    ws.send(JSON.stringify({ type: 'ping' }))
    await new Promise((r) => setTimeout(r, 50))

    // lastHeartbeat should be updated after pong
    expect(client.lastHeartbeat).toBeGreaterThan(0)
  })
})
