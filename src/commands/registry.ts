import { Logger, Assert } from '@lib/logast.js'
import { AppCommand, AppCommandGroup, RuntimeAppCommand } from './types.js'

const commandGroupMap = new Map<string, AppCommandGroup>();
const commandMap = new Map<string, AppCommand<any>>();

// 定义并注册一个命令组，用于组织相关命令
export function defineCommandGroup(cmdGroup: AppCommandGroup): AppCommandGroup {
  return registerCommandGroup(cmdGroup);
}

// 定义并注册一个命令，主要用于静态命令
export function defineCommand<TArgs>(cmd: AppCommand<TArgs>): AppCommand<TArgs> {
  // overwrite = false, 便于发现重复注册的问题
  return registerCommand(cmd, false);
}

// 定义并注册一个运行时命令，主要用于动态生成的命令
export function defineRuntimeCommand<TArgs>(cmd: RuntimeAppCommand<TArgs>): AppCommand<TArgs> {
  Logger.debug('CommandRegistry', `Defining Runtime Command: ${cmd.id}`);
  // 强制加入 Runtime 组，便于调试
  // overwrite = true, 可以重复调用不出错，方便使用
  return registerCommand({ ...cmd, group: 'runtime' }, true);
}

// 注销一个运行时命令
export function unregisterRuntimeCommand(id: string): void {
  Logger.debug('CommandRegistry', `Unregistering Runtime Command: ${id}`);
  const cmd = commandMap.get(id);
  const cmdGroup = commandGroupMap.get('runtime');
  if (cmd) {
    commandMap.delete(id);    
    Logger.debug('CommandRegistry', `Unregistered Runtime Command: ${id}`);
  }
  if (cmdGroup && cmd?.group === 'runtime') {
    cmdGroup.commands = cmdGroup.commands.filter(c => c.id !== id);
  }
}

function registerCommandGroup(cmdGroup: AppCommandGroup): AppCommandGroup {
  Assert.notEmpty(cmdGroup.id, 'Command group id must not be empty')
  Assert.notEmpty(cmdGroup.title, 'Command group title must not be empty');
  // Logger.debug('CommandRegistry', `Registering CommandGroup: ${cmdGroup.id}`)

  if (commandGroupMap.has(cmdGroup.id))
    throw new Error(`Duplicate command group id: ${cmdGroup.id}`);

  // 修复：确保 commands 字段为数组
  if (!Array.isArray(cmdGroup.commands)) {
    cmdGroup.commands = [];
  }

  commandGroupMap.set(cmdGroup.id, cmdGroup);
  return cmdGroup;
}

// overwrite 为 true 时, 如果命令已经存在，将被覆盖，否则会抛出错误
function registerCommand<TArgs>(cmd: AppCommand<TArgs>, overwrite: boolean = false): AppCommand<TArgs> {
  Assert.notEmpty(cmd.id, 'Command id must not be empty');
  Assert.isFunction(cmd.run, `Command callback must be a function: ${cmd.id}`);
  // Logger.debug('CommandRegistry', `Registering Command: ${cmd.id}`);

  // 检查，要求输入的热键标识必须采用内部标准表达方式
  // Meta/Ctrl/Mod/Alt/Shift+Key 这种，不允许使用平台相关的标识
  // Ctrl = Windows/Linux 的 Ctrl, MacOS 的 Control 键
  // Mod = Windows/Linux 的 Ctrl 键，MacOS 的 Command 键
  if (cmd.shortcut) {
    const invalidModifiers = ['Cmd', 'Win', 'Super', 'Option', 'Command', 'Control', 'Windows'];
    for (const mod of invalidModifiers) {
      if (cmd.shortcut.includes(mod)) {
        throw new Error(`Invalid modifier "${mod}" in command shortcut: ${cmd.shortcut}`);
      }
    }
  }

  if (!overwrite && commandMap.has(cmd.id))
    throw new Error(`Duplicate command id: ${cmd.id}`);

  commandMap.set(cmd.id, cmd);

  if (cmd.group) {
    const group = commandGroupMap.get(cmd.group);
    if (!group)
      throw new Error(`Command group not found: ${cmd.group}`);

    // 如果同ID的命令已经存在，覆盖之，否则追加之。
    const index = group.commands.findIndex(c => c.id === cmd.id);
    if (index >= 0)
      group.commands[index] = cmd;
    else
      group.commands.push(cmd);
  } 
  return cmd;
}

export function getCommand(id: string): AppCommand | undefined {
  Assert.isString(id, 'Command id must be a string');
  return commandMap.get(id)
}

export const getAppCommand = getCommand;

export function getAllCommands(): AppCommand[] {
  return Array.from(commandMap.values())
}

export function getAllCommandGroups(): AppCommandGroup[] {
  return Array.from(commandGroupMap.values())
}

// dispatch 一个 AppCommand，需要 命令的ID 和 args
export async function dispatchCommand<TArgs = void>
  (id: string, args: TArgs extends void ? void : TArgs): Promise<void> {
  const cmd = commandMap.get(id) as AppCommand<TArgs> | undefined;
  if (!cmd) throw new Error(`Command not found: ${id}`);
  //Logger.debug(`Dispatching AppCommand: ${id}`, args);
  await cmd.run(args);
}

export const dispatchAppCommand = dispatchCommand;
