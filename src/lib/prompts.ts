// general prompts loader
// all prompts are stored in markdown files under /kb/system/core/prompts/general/
// 访问时按路径访问。
// Prompt Id: /A/B/C/id
// (A/B为目录名，C为Markdown文件名,不包括.md后缀，id为文件内该Prompt的标题)

import { parseMarkdownSections } from "@lib/mdparser.js";
import { removeFencedCodeBlockMarker } from "@lib/utils.js";

// PTI: Prompt Template Item
export type PTI = {
  id: string;                   // 唯一标识符

  title?: string;               // 显示标题
  description?: string;         // 简短描述

  tool_description?: string;    // 作为工具时的描述
  equipped_tools?: string;      // 作为Agent时预装的工具集

  documentation?: string;       // 详细说明
  source?: string;              // 来源说明
  alrogithm?: string;           // 算法说明
  input?: string;               // 输入说明
  output?: string;              // 输出说明

  template: string;             // 模板文本，内部的变量用 {{var}} 标记
  variables?: string[];         // 解析出的模板变量列表
}

// 解析单个 Prompt Markdown 文件内容，返回其中所有 Prompt 模板项
export function parsePromptsFile(idPrefix: string, markdown: string): PTI[] {
  const sections = parseMarkdownSections(markdown);

  return sections.map((section) => {
    const prompt: PTI = {
      id: (idPrefix + section.title.trim()).toLowerCase(),
      template: '',
    };

    section.children.forEach((child) => {
      const key = child.title.trim().toLowerCase();
      const value = child.content.join('\n').trim();

      switch (key) {
        case 'title':
          prompt.title = value;
          break;
        case 'description':
          prompt.description = value;
          break;
        case 'tool description':
          prompt.tool_description = value;
          break;
        case 'equipped tools':
          prompt.equipped_tools = value;
          break;
        case 'documentation':
          prompt.documentation = value;
          break;
        case 'source':
          prompt.source = value;
          break;
        case 'algorithm':
          prompt.alrogithm = value;
          break;
        case 'input':
          prompt.input = value;
          break;
        case 'output':
          prompt.output = value;
          break;
        case 'prompt template':
          prompt.template = removeFencedCodeBlockMarker(value);
          break;
        default:
          prompt[key] = value;
          break;
      }
    });

    return prompt;
  });
}

export type GetPromptFunc = (id: string) => PTI;

export class PromptTemplate {
  protected pti: PTI;

  // id: 存放在 kb/system/core/prompts/general/ 目录下的 Prompt 模板 ID
  // 例如：/agent/hello 表示 hello.md 文件中的 hello 模板
  constructor(id: string, getPromptFunc: GetPromptFunc) {
    this.pti = getPromptFunc!(id);

    // 解析模板变量列表
    const regex = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;
    let match;
    const vars: string[] = [];
    while ((match = regex.exec(this.pti.template)) !== null) {
      if (!vars.includes(match[1]))
        vars.push(match[1]);
    }
    this.pti.variables = vars;
  }

  get id(): string {
    return this.pti.id;
  }

  // 获取原始模板文本
  get template(): string {
    return this.pti.template;
  }

  // 创建一个 使用此模板的 新的 Prompt 实例，尚未填充变量
  new(): Prompt {
    return new Prompt(this.pti);
  }

  // 填充唯一变量，返回准备好的PROMPT，内部会进行检查并输出警告日志
  setVariable(variable: string, value: string): string {
    return new Prompt(this.pti).setVariable(variable, value).check().toString();
  }

  // 填充(所有)多个变量，返回准备好的PROMPT，内部会进行检查并输出警告日志
  setVariables(variables: Record<string, string>): string {
    return new Prompt(this.pti).setVariables(variables).check().toString();
  }

  toString(): string {
    return this.pti.template;
  }

  toJSON(): string {
    return this.toString();
  }
}

// Prompt 实例，支持变量替换和检查
export class Prompt {
  protected _pti: PTI;
  protected _prompt?: string;

  constructor(pti: PTI) {
    this._pti = pti;
  }

  get pti(): PTI {
    return this._pti;
  }

  // 检查 Prompt 模板中是否还有未替换的变量标记或错误内容
  // 只警告不抛出错误:
  //   1. 是否还有未替换的变量标记 {{var}} 判断并不严格准确，比如变量值就是自己这个提示符模板。。。
  //   2. 或者有时可能就是想保留某些变量标记以供后续处理
  //   3. 模板ID不存在，不可序列化对象等，都是开发阶段的问题，生产阶段不应出现
  check(): this {
    if (!this._prompt) {
      console.warn('PROMPT', `Prompt  ${this._pti.id} not filled yet.`);
      return this;
    }

    // 根据之前解析出的模板变量列表，检查是否还有未替换的变量
    if (this._pti.variables) {
      for (const variable of this._pti.variables) {
        const varTag = `{{${variable}}}`;
        if (this._prompt.includes(varTag)) {
          console.warn('PROMPT', `Prompt ${this._pti.id} may have unreplaced variable: ${varTag}`);
          return this;
        }
      }
    }

    // 检查是否有不可序列化的对象残留
    if (this._prompt.includes('[object Object]')) {
      // 取得错误所在位置的上下文
      const regex = /(.{0,10}\[object Object\].{0,10})/;
      const match = regex.exec(this._prompt);
      if (match)
        console.warn('PROMPT', `Prompt ${this._pti.id} may have unreplaced object variable: ...${match[1]}...`);
      return this;
    }
    return this;
  }

  // 替换单个变量
  setVariable(variable: string, value: string): Prompt {
    if (this.pti.variables && !this.pti.variables.includes(variable)) {
      console.error('PROMPT', `Prompt ${this._pti.id} has no such variable: ${variable}`);
      throw new Error(`Prompt ${this._pti.id} has no such variable: ${variable}`);
    }
    if (value && value.includes('[object Object]')) {
      console.error('PROMPT', `Prompt ${this._pti.id} variable ${variable} value may be an object: ${value}`);
      throw new Error(`Prompt ${this._pti.id} variable ${variable} value may be an object: ${value}`);
    }

    const varTag = `{{${variable}}}`;
    this._prompt = this._pti.template.split(varTag).join(value);
    return this;
  }

  // 替换多个变量
  setVariables(variables: Record<string, string>): Prompt {
    this._prompt  = this._pti.template;
    for (const [key, value] of Object.entries(variables)) {
      if (this.pti.variables && !this.pti.variables.includes(key)) {
        console.warn('PROMPT', `Prompt ${this._pti.id} has no such variable: ${key}`);
        throw new Error(`Prompt ${this._pti.id} has no such variable: ${key}`);
      }
      if (value && value.includes('[object Object]')) {
        console.warn('PROMPT', `Prompt ${this._pti.id} variable ${key} value may be an object: ${value}`);
        throw new Error(`Prompt ${this._pti.id} variable ${key} value may be an object: ${value}`);
      }
      const varTag = `{{${key}}}`;
      this._prompt = this._prompt.split(varTag).join(value);
    }
    return this;
  }

  toString(): string {
    if (!this._prompt) {
      console.warn('PROMPT', `Prompt  ${this._pti.id} not filled yet.`);
      return '';
    }
    return this.check()._prompt!;
  }

  toJSON(): string {
    return this.toString();
  }
}
