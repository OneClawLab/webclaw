// 一个基本的通用事件总线实现

export type EventHandler<T = any> = (payload: T) => void | Promise<void>

interface WaitOptions {
  timeout?: number
  signal?: AbortSignal
}

export class EventBus<Events extends Record<string, any> = any> {
  private listeners: { [K in keyof Events]?: Set<EventHandler<Events[K]>> } = {}

  on<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>) {
    if (!this.listeners[event]) this.listeners[event] = new Set()
    this.listeners[event]!.add(handler)
    return () => this.off(event, handler)
  }

  once<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>) {
    const off = this.on(event, async (payload) => {
      off()
      await handler(payload)
    })
    return off
  }

  off<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>) {
    this.listeners[event]?.delete(handler)
  }

  async emit<K extends keyof Events>(event: K, payload: Events[K]) {
    //Logger.debug('EventBus', `Emitting event: ${String(event)}, payload: ${payload ? JSON.stringify(payload) : 'void' }`);

    const handlers = Array.from(this.listeners[event] ?? [])
    for (const handler of handlers)
      await Promise.resolve(handler(payload))
  }

  clear() {
    this.listeners = {}
  }

  /**
   * 等待某事件触发，可设置超时和取消信号
   */
  waitFor<K extends keyof Events>(
    event: K,
    options: WaitOptions = {}
  ): Promise<Events[K]> {
    const { timeout, signal } = options

    return new Promise((resolve, reject) => {
      let timer: any
      const off = this.once(event, (payload) => {
        clearTimeout(timer)
        resolve(payload)
      })

      if (timeout) {
        timer = setTimeout(() => {
          off()
          reject(new Error(`EventBus.waitFor("${String(event)}") timed out`))
        }, timeout)
      }

      if (signal) {
        signal.addEventListener('abort', () => {
          off()
          clearTimeout(timer)
          reject(new Error(`EventBus.waitFor("${String(event)}") aborted`))
        })
      }
    })
  }
}
