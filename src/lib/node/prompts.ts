// prompts loader
// 所有 prompts 存储在 /kb/system/core/prompts/ 目录下的 markdown 文件中
// 访问时按路径访问。
// Prompt Id: /A/B/C/id
// (A为目录名，B为Markdown文件名,不包括.md后缀，id为文件内该Prompt的一级标题名称)

import { PATH_PROMPTS } from "@lib/paths.js";
import { parsePromptsFile, PromptTemplate, PTI } from "@lib/prompts.js";
import { getBridgeImpls } from "@node/bridge/bridges.impls.js";
import { Logger } from "@node/logger.js";

// 递归解析指定目录下的所有 Prompt Markdown 文件，扁平化存储到 Map 中
async function parsePromptsDir(dirPath: string, idPrefix: string, allPrompts: Map<string, PTI>) {
  const fsImpl = getBridgeImpls().fs;
  const items = fsImpl.listDir(dirPath);

  for (const item of items) {
    if (item.isFile) {
      if (!item.name.toLowerCase().endsWith('.md')) continue;
      const itemId = item.name.slice(0, -3); // remove .md

      const content = fsImpl.readText(item.path);
      const prompts = parsePromptsFile(idPrefix + itemId + '/', content);

      for (const cmd of prompts) {
        if (allPrompts.has(cmd.id.toLowerCase()))
          Logger.warn(`Duplicate prompt id: ${cmd.id}, overwriting.`);
        allPrompts.set(cmd.id.toLowerCase(), cmd);
      }
    } else {
      await parsePromptsDir(item.path, idPrefix + item.name + '/', allPrompts);
    }
  }
}

let cachedPromptsDirSignature: string | null = null;
let cachedPrompts: Map<string, PTI> | null = null;

// 异步加载 所有 Prompts模板，缓存到内部扁平化的Map中。
// 目录内容有任何变化时会全部重新加载。
export async function asyncLoadPrompts(): Promise<void> {
  const fsImpl = getBridgeImpls().fs;
  const rootPath = PATH_PROMPTS();
  const exists = fsImpl.exists(rootPath);
  if (!exists) {
    Logger.error('PROMPT', `Prompts directory does not exist: ${rootPath}`);
    throw new Error(`Prompts directory does not exist: ${rootPath}`);
  }
  const newSignature = fsImpl.getDirSignature(rootPath);
  if (newSignature === cachedPromptsDirSignature)
    return;

  const prompts: Map<string, PTI> = new Map();
  await parsePromptsDir(rootPath, '/', prompts);

  cachedPromptsDirSignature = newSignature;
  cachedPrompts = prompts;
}

const node_getPromptFunc = (id: string) => {
  asyncLoadPrompts(); // TODO: 每次都触发异步更新缓存，开发模式下可用，生产模式下需要改进
  if (!cachedPrompts) {
    Logger.error('PROMPT', 'Prompts not loaded yet for id:', id);
    throw new Error('Prompts not loaded yet');
  }
  if (!cachedPrompts.has(id.toLowerCase())) {
    Logger.error('PROMPT', 'Prompt not found for id:', id);
    throw new Error(`Prompt not found: ${id}`);
  }
  const pti = cachedPrompts.get(id.toLowerCase());
  if (!pti) {
    Logger.error('PROMPT', 'Prompt not found for id:', id);
    throw new Error(`Prompt not found: ${id}`);
  }
  return pti;
}

// 直接获取 加载的 PTI 实例
export function getPTI(id: string): PTI {
  return node_getPromptFunc(id);
}

// PromptTemplate 实例的快捷函数
export function TEMPLATE(id: string): PromptTemplate {
  return new PromptTemplate(id, node_getPromptFunc);
}

// 快捷函数：直接获取 Prompt 模板文本
export function PROMPT(id: string): string {
  return new PromptTemplate(id, node_getPromptFunc).template;
}
