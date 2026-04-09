import { Logger, Assert } from '@lib/logast.js'
import { EditorCommand } from './types.js'
import { EditorView } from '@codemirror/view'

const commandMap = new Map<string, EditorCommand<any>>();

export function defineCommand<TArgs>
  (cmd: EditorCommand<TArgs>): EditorCommand<TArgs> {
  return registerCommand(cmd);
}

export function registerCommand<TArgs>
  (cmd: EditorCommand<TArgs>): EditorCommand<TArgs> {
  Assert.notEmpty(cmd.id, 'Command id must not be empty');
  Assert.notEmpty(cmd.title, 'Command title must not be empty');
  Assert.isFunction(cmd.run, `Command callback must be a function: ${cmd.id}`);
  // Logger.debug('CommandRegistry', `Registering Command: ${cmd.id}`);

  // 检查，要求输入的热键标识必须采用内部标准表达方式
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

  if (commandMap.has(cmd.id))
    throw new Error(`Duplicate command id: ${cmd.id}`);
  commandMap.set(cmd.id, cmd);
  return cmd;
}

export function getCommand(id: string): EditorCommand | undefined {
  Assert.isString(id, 'Command id must be a string');
  return commandMap.get(id)
}

export const getEditorCommand = getCommand;

export function getAllCommands(): EditorCommand[] {
  return Array.from(commandMap.values())
}

// dispatch 一个 AppCommand，需要 命令的ID 和 args
export async function dispatchCommand<TArgs = void>
  (id: string, view: EditorView, args: TArgs extends void ? void : TArgs): Promise<boolean> 
{
  const cmd = commandMap.get(id) as EditorCommand<TArgs> | undefined;
  if (!cmd) throw new Error(`Command not found: ${id}`);
  //Logger.debug(`Dispatching EditorCommand: ${id}`, args);
  return await cmd.run(view, args);
}

export const dispatchEditorCommand = dispatchCommand;
