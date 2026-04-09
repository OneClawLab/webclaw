import { Logger } from "@lib/logast.js"
import { path } from "@lib/path.js"
import { PATH_KBS } from "@lib/paths.js"
import { getSlashCommands } from "./SlashCommands.js"

export type DocRange = { from: number, to: number }

// 用户原始输入被(语法)解析后 成为 ParsedPrompt 结构。
// 从语法上来讲，用户输入的内容会被分为四类：/@ 指令，以及text。
type ParsedCommand = { type: 'command', name: string, args?: string }
type ParsedReference = { type: 'reference', uri: string, args?: string }
type ParsedText = { type: 'text', text: string }
type ParsedBlock = ParsedCommand | ParsedReference | ParsedText;

// 对用户输入进行语法解析后的 PROMPT 结构
export type ParsedPrompt = {
  blocks: ParsedBlock[]  // 按出现顺序排列的 解析块 列表
}

// 对 ParsedPrompt 进行前端预处理后的 PROMPT 结构。
// UI层的预处理包括：
// 1. 处理UI层该处理的/命令 和 @引用
// 2. 其他UI层各种转换或转义等
export type PreparedPrompt = {
  raw: boolean        // raw 模式，意味着 使用底层的 raw front agent 处理，主要用于测试PROMPT效果
  newtab: boolean     // 是否将输出重定向到一个新的标签页
  text: string        // UI层预处理过的 text, 将发给 agent 层继续处理
}

// 发给底层的 PROMPT 结构
export type UserPrompt = {
  text: string        // 上层处理后的 prompt 文本
}

// 已知的 命令/引用 名称 集合
// 未提供时表示不过滤名称
export type KnownNames = {
  commands?: Set<string>
  references?: Set<string>
}

// 把用户输入解析为 ParsedPrompt 结构
// 如果 checkNames 为 true，则只解析已知名称的命令/引用
export function parsePrompt(input: string, knownNames?: KnownNames): ParsedPrompt {
  // /@ 的语法规则
  //    行头或空白字符之后开始
  //    中间是UNICODE名称
  //    结尾是空白字符或行尾

  // 说明：
  // - 使用“前导边界” (^|\\s) 来满足“行头或空白之后开始”
  // - 使用 lookahead (?=\\s|$) 来满足“结尾是空白或行尾”
  // - 采用命名捕获组，避免 combined alternation 下捕获组序号脆弱的问题
  // - reference 的 uri 规则：不允许空白，且在常见闭合符号/标点前停止（可按需再调整）
  const combinedRegex = new RegExp(
    [
      // /command
      String.raw`(^|\s)\/(?<cmd>\+?[\p{L}\p{N}_.-]+)(?=\s|$)`,
      // @reference
      String.raw`(^|\s)@(?<ref>[^\s)\]}）】·,，。．？?！!]+)(?=\s|$)`,
    ].join('|'),
    'gu'
  );

  const blocks: ParsedBlock[] = [];

  let lastIndex = 0;
  for (const m of input.matchAll(combinedRegex)) {
    const matchIndex = m.index!;
    const fullMatch = m[0];

    const g = (m as RegExpMatchArray & { groups?: Record<string, string> }).groups ?? {};

    // 先把“匹配之前”的所有内容作为 text（包含可能的空白）
    if (matchIndex > lastIndex) {
      blocks.push({ type: 'text', text: input.slice(lastIndex, matchIndex) });
    }

    if (g.cmd) {
      const name = g.cmd;
      const matchStr = '/' + name;

      // fullMatch 可能包含前导空白；切出前导部分，保持原输入不丢失
      const leadLen = fullMatch.length - matchStr.length;
      if (leadLen > 0) blocks.push({ type: 'text', text: fullMatch.slice(0, leadLen) });

      if (!knownNames || !knownNames.commands || knownNames.commands.has(name)) {
        blocks.push({ type: 'command', name });
      } else {
        blocks.push({ type: 'text', text: matchStr });
      }

      lastIndex = matchIndex + fullMatch.length;
      continue;
    }

    if (g.ref) {
      const uri = g.ref;
      const matchStr = '@' + uri;

      const leadLen = fullMatch.length - matchStr.length;
      if (leadLen > 0) blocks.push({ type: 'text', text: fullMatch.slice(0, leadLen) });

      if (!knownNames || !knownNames.references || knownNames.references.has(uri)) {
        blocks.push({ type: 'reference', uri });
      } else {
        blocks.push({ type: 'text', text: matchStr });
      }

      lastIndex = matchIndex + fullMatch.length;
      continue;
    }

    // 兜底：把本次匹配当文本（包含前导）
    blocks.push({ type: 'text', text: fullMatch });
    lastIndex = matchIndex + fullMatch.length;
  }

  if (lastIndex < input.length) {
    blocks.push({ type: 'text', text: input.slice(lastIndex) });
  }

  const parsedPrompt: ParsedPrompt = { blocks };
  Logger.debug('Parsed prompt:', parsedPrompt);
  return parsedPrompt;
}

// 执行 ParsedPrompt，调用相应的命令/引用，生成 PreparedPrompt 结构
export async function preparePrompt(prompt: string): Promise<PreparedPrompt> {
  // 取得已知的命令/引用 名称集合，以便语法解析时使用

  const knownNames: KnownNames = {
    commands: new Set(getSlashCommands().keys()),
    // references: ... // TODO: 填充已知引用名称
  };

  // 语法解析
  const parsedPrompt = parsePrompt(prompt, knownNames);

  /// 解析处理 modifiers，目前我们支持两个: +raw, +newtab

  const hasRawModifier = parsedPrompt.blocks.some(block => block.type === 'command' && block.name === '+raw');
  const hasNewtabModifier = parsedPrompt.blocks.some(block => block.type === 'command' && block.name === '+newtab');

  // @ references 展开为 POSIX 绝对文件系统路径
  parsedPrompt.blocks.forEach(block => {
    if (block.type === 'reference') {
      // parsePrompt 中的 uri 不包含 '@'
      if (block.uri.startsWith('kb/')) {
        // @kb/... → {PATH_KBS()}/{relative_path} 展开为 POSIX 绝对路径
        block.uri = path.toPosixPath(path.join(PATH_KBS(), block.uri.slice('kb/'.length)));
      } else if (!block.uri.startsWith('/')) {
        block.uri = `/${block.uri}`;
      }
    }
  });

  // 根据 command 套用 模板，生成最终的 prompt text
  // 只处理第一个 非修饰命令
  const mainCommand = parsedPrompt.blocks.find(block => {
    return (block.type === 'command' && !block.name.startsWith('+'));
  }) as ParsedCommand | undefined;

  const raw_text = parsedPrompt.blocks.reduce((acc, block) => {
    if (block.type === 'text') {
      return acc + block.text;
    } else if (block.type === 'reference') {
      return acc + block.uri;
    } else if (block.type === 'command') {
      // skip main command and modifiers
      if (block === mainCommand || block.name.startsWith('+')) {
        return acc;
      } else {
        return acc + '/' + block.name;
      }
    }
    return acc;
  }, '');

  let rendered_text = raw_text;
  if (mainCommand) {
    const cmd = getSlashCommands().get(mainCommand!.name);
    if (!cmd)
      Logger.error(`Slash Command not found: ${mainCommand!.name}`);
    if (cmd && !cmd.template)
      Logger.error(`Slash Command has no template: ${mainCommand!.name}`);
    // 把 prompt.text 填入模板
    rendered_text = cmd && cmd.template && cmd.template.replace('{{text}}', raw_text) || raw_text;
  }

  const preparedPrompt = {
    raw: hasRawModifier,
    newtab: hasNewtabModifier,
    text: rendered_text.trim(),
  };

  Logger.debug('Prepared prompt:', preparedPrompt);
  return preparedPrompt;
}
