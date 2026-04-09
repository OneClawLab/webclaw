import { Logger, Assert } from '@lib/logast.js'
import hotkeys from 'hotkeys-js'
import { HotkeyCommand } from './types.js'
import { OS } from '@lib/env.js';

/**
 * HotkeyManager 用于管理全局热键的注册、注销和查询。
 * 通过 hotkeys-js 库实现热键监听和触发。
 */
export class HotkeyManager {
  // 存储所有已注册的热键命令，key 为命令 id，value 为 HotkeyCommand 对象
  private registry = new Map<string, HotkeyCommand>()

  constructor() {
    // 初始化时可以设置默认作用域
    hotkeys.setScope('all')

    // // DEBUG probe: 观察事件是否能到 document（如果这里都收不到，hotkeys-js 也收不到）
    // document.addEventListener('keydown', (e) => {
    //   const mod = (e.ctrlKey ? 'C' : '') + (e.metaKey ? 'M' : '') + (e.altKey ? 'A' : '') + (e.shiftKey ? 'S' : '')
    //   if (e.key?.toLowerCase() === 'w' && (e.ctrlKey || e.metaKey)) {
    //     Logger.debug('HotkeyManager', `[probe] keydown Mod+W received, mods=${mod}, defaultPrevented=${e.defaultPrevented}`)
    //   }
    // }, true) // 用 capture 更容易看到“被拦截前”的事件

    // // 临时探针：验证 hotkeys-js 是否能触发 handler（用一个不会被系统抢走的组合键）
    // hotkeys('mod+shift+9', { scope: 'all' }, (e) => {
    //   Logger.debug('HotkeyManager', `[probe] hotkeys-js handler fired: mod+shift+9, defaultPrevented=${e.defaultPrevented}`)
    //   e.preventDefault()
    // })

    // 返回 false 将禁止 hotkeys 检测该热键
    hotkeys.filter = function(event: KeyboardEvent): boolean {
      const target = (event.target || event.srcElement) as HTMLInputElement;
      const { tagName } = target;
      const isInput = tagName === 'INPUT' && !['checkbox', 'radio', 'range', 'button', 'file', 'reset', 'submit', 'color'].includes(target.type);
      return !(isInput || tagName === 'TEXTAREA' || tagName === 'SELECT');

      // // 以下拷贝自 hotkeys-js 的默认实现
      // // 主要功能是：忽略在输入框、文本域、可编辑元素内的热键事件。
      // const target = (event.target || event.srcElement) as HTMLInputElement;
      // const { tagName } = target;
      // let flag = true;
      // const isInput = tagName === 'INPUT' && !['checkbox', 'radio', 'range', 'button', 'file', 'reset', 'submit', 'color'].includes(target.type);
      // // ignore: isContentEditable === 'true', <input> and <textarea> when readOnly state is false, <select>
      // if (target.isContentEditable || (isInput || tagName === 'TEXTAREA' || tagName === 'SELECT') && !target.readOnly) {
      //   flag = false;
      // }
      // return flag;
    }
  }

  /**
   * 切换当前热键作用域（scope）。
   * @param scope 作用域名称
   */
  setScope(scope: string) {
    hotkeys.setScope(scope)
  }

  /**
   * 获取当前热键作用域（scope）。
   * @returns 当前作用域名称
   */
  getScope(): string {
    return hotkeys.getScope()
  }

  /**
   * 注册一个热键命令。
   * @param cmd HotkeyCommand 对象，包含 id、keys、callback、scope 等信息
   */
  register(cmd: HotkeyCommand) {
    Logger.debug('HotkeyManager', cmd.id + ' <= ' + (Array.isArray(cmd.keys) ? cmd.keys.join(', ') : cmd.keys));

    // 检查是否已存在相同 id 的热键，避免重复注册
    if (this.registry.has(cmd.id)) {
      console.warn(`Duplicate command id: ${cmd.id}`)
      return
    }

    // 将命令存入注册表
    this.registry.set(cmd.id, cmd)

    // 支持单个或多个快捷键
    const keys = Array.isArray(cmd.keys) ? cmd.keys : [cmd.keys]
    const scope = cmd.scope || 'all'
    const capture = cmd.capture || false

    keys.forEach(key => {
      // 把 Mod 替换为具体的修饰键名称，因为 hotkeys-js 有时有BUG不能转换正确
      if (OS === 'windows' || OS === 'linux') {
        // 在 Windows/Linux 上，避免使用 'Mod'，改为 'Ctrl'
        key = key.replace('Mod', 'Ctrl');
      } else if (OS === 'macos') {
        // 在 macOS 上，避免使用 'Mod'，改为 'Command'
        key = key.replace('Mod', 'Command');
      }

      // 注册热键监听，指定作用域（默认为 'all'）
      // Logger.debug('HotkeyManager', `Registering command: ${cmd.id} with hotkey: ${key}`);
      hotkeys(key, { scope, capture }, (e) => {
          Logger.debug('HotkeyManager', `Triggered command: ${cmd.id} with hotkey: ${key}`);
          e.preventDefault();   // 阻止默认行为（如浏览器快捷键)
          // 标记事件已被HotkeyManager处理，但不要阻止冒泡，以免影响其他监听器
          (e as any).__handledByHotkeyManager = true;
          cmd.callback({})      // 执行回调
        });
    })
  }

  /**
   * 注销一个已注册的热键命令。
   * @param id 热键命令的唯一 id
   */
  unregister(id: string) {
    const cmd = this.registry.get(id)
    if (!cmd) return

    // 支持单个或多个快捷键
    const keys = Array.isArray(cmd.keys) ? cmd.keys : [cmd.keys]
    const scope = cmd.scope || 'all'

    keys.forEach(key => { hotkeys.unbind(key, scope) })
    this.registry.delete(id)
  }

  /**
   * 获取所有已注册的热键命令。
   * @returns HotkeyCommand 数组
   */
  getAll(): HotkeyCommand[] {
    return Array.from(this.registry.values())
  }
}
