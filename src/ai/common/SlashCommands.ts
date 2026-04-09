import { Logger } from "@lib/logger.js";
import { parseMarkdownSections } from "@lib/mdparser.js";
import { PATH_SLASH_COMMANDS } from "@lib/paths.js";
import { removeFencedCodeBlockMarker } from "@lib/utils.js";

// 定义单个 Slash Command
export interface SlashCommand {
  id: string;                   // 唯一标识符，用于输入匹配
  title: string;                // 显示标题
  description?: string;         // 简短描述
  documentation?: string;       // 详细说明, 即 autocompletion里的 tooltip
  template?: string;            // 可选的 PromptTemplate
  group?: string;               // 所属组的路径, 目前只支持: 'modifier', 'basic', 'advanced', 'custom'
                                // 展示时(匹配的所有命令) 先按组排序，再按标题排序
}

function parseMarkdownFile(group: string, markdown: string): SlashCommand[] {
  const sections = parseMarkdownSections(markdown);

  return sections.map((section) => {
    const command: SlashCommand = {
      id: section.title.trim(),
      title: '',
      template: undefined,
      group,
    };

    section.children.forEach((child) => {
      const key = child.title.trim().toLowerCase();
      let content = child.content.join('\n').trim();

      switch (key) {
        case 'title':
          command.title = content;
          break;
        case 'description':
          command.description = content;
          break;
        case 'documentation':
          command.documentation = content;
          break;
        case 'prompt template':
          content = removeFencedCodeBlockMarker(content);
          command.template = content;
          break;
      }
    });

    return command;
  });
}

async function parseMarkdownDir(path: string, flattenedCommands: Map<string, SlashCommand>): Promise<void> {
  const items = await window.fs.listDir(path);
  for (const item of items) {
    if (item.isFile) {
      if (!item.name.toLowerCase().endsWith('.md'))
        continue;
      // 使用文件名做为组名
      const group = item.name.substring(0, item.name.length - 3); // 去掉 .md 后缀
      const content = await window.fs.readText(item.path);
      const commands = parseMarkdownFile(group, content);
      for (const cmd of commands)
        flattenedCommands.set(cmd.id, cmd);
    } else {
      await parseMarkdownDir(item.path, flattenedCommands);
    }
  }
}

let dirSignature: string | null = null;
let cachedCommands: Map<string, SlashCommand> | null = null;
let cachedSortedGroups: { group: string, commands: Map<string, SlashCommand> }[] | null = null;

// 异步加载所有 Slash Commands
// 会缓存结果，除非目录内容发生变化
export async function asyncLoadSlashCommands(): Promise<Map<string, SlashCommand>> {
  const rootPath = PATH_SLASH_COMMANDS();
  const exists = await window.fs.exists(rootPath);
  if (!exists) {
    Logger.error(`Slash commands directory does not exist: ${rootPath}`);
    throw new Error(`Slash commands directory does not exist: ${rootPath}`);
  }
  const newSignature = await window.fs.getDirSignature(rootPath);
  if (newSignature === dirSignature)
    return cachedCommands!;

  const flattenedCommands: Map<string, SlashCommand> = new Map();
  await parseMarkdownDir(rootPath, flattenedCommands);

  cachedSortedGroups = sortSlashCommandsIntoGroups(flattenedCommands);
  dirSignature = newSignature;
  cachedCommands = flattenedCommands;
  return flattenedCommands;
}

// 获取所有 Slash Commands
// 可能返回缓存的结果，第一次调用时会触发异步更新缓存
export function getSlashCommands(): Map<string, SlashCommand> {
  asyncLoadSlashCommands(); // 触发异步更新缓存
  if (!cachedCommands)
    return new Map();
  return cachedCommands;
}

// 获取所有 Slash Commands
// 可能返回缓存的结果，第一次调用时会触发异步更新缓存
// 如果指定 group，则只返回该组的命令
// 返回排序的组列表，每组内的命令按标题排序
export function getGroupedSlashCommands(): { group: string, commands: Map<string, SlashCommand> }[] {
  asyncLoadSlashCommands(); // 触发异步更新缓存
  if (!cachedSortedGroups)
    return [];
  return cachedSortedGroups;
}

function sortSlashCommandsIntoGroups(flattenedCommands: Map<string, SlashCommand>): { group: string, commands: Map<string, SlashCommand> }[] {
  if (!flattenedCommands)
    return [];

  const groups = new Map<string, Map<string, SlashCommand>>();
  flattenedCommands.forEach((cmd) => {
    const group = cmd.group || 'unknown';
    if (!groups.has(group))
      groups.set(group, new Map());
    groups.get(group)!.set(cmd.id, cmd);
  });

  // 对组进行排序：'modifier' > 'basic' > 'advanced' > 'custom' > 其他按字母顺序
  const groupOrder: string[] = ['modifier', 'basic', 'advanced', 'custom'];
  const sortedGroups = new Map<string, Map<string, SlashCommand>>();
  groupOrder.forEach((group) => {
    if (groups.has(group)) {
      sortedGroups.set(group, groups.get(group)!);
      groups.delete(group);
    }
  });

  // 处理剩余的组，按字母顺序排序
  const remainingGroups = Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  remainingGroups.forEach(([group, commands]) => {
    sortedGroups.set(group, commands);
  });

  // 返回排序后的组列表，每组内的命令也按命令ID排序
  return Array.from(sortedGroups.entries()).map(([group, commands]) => ({
    group,
    commands: new Map([...commands].sort((a, b) => a[0].localeCompare(b[0])))
  }));
}
