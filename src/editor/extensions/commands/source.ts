import { Logger } from "@lib/logast.js";
import { CompletionSource } from "@codemirror/autocomplete";
import { isPosInFencedCodeBlock } from "@editor/CmUtils.js";
import { getCompletions } from "./completions.js";

export const CMD_MATCH_BEFORE_REGEX = /(^|\s)\/$/;

export const cmdCompletionSource: CompletionSource = (ctx) => {
  // fenced code block 里不触发命令
  if (isPosInFencedCodeBlock(ctx.state, ctx.pos))
    return null;

  // 只有在行开头或前面有空格时才匹配触发字符
  const match = ctx.matchBefore(CMD_MATCH_BEFORE_REGEX);
  if (!match)
    return null;
  if (!ctx.view) {
    Logger.warn("CommandTrigger", `No view in context for command trigger: /`);
    return null;
  }

  // 计算实际的触发字符位置（排除前面的空格）
  const triggerStart = match.text.startsWith("/") ? match.from : match.from + 1;

  // 获取补全项
  const completions = getCompletions();
  if (!completions || completions.length === 0)
    return null;

  return { 
    from: triggerStart, // 从触发字符开始，不包括前面的空格
    to: match.to,
    validFor: () => true,
    filter: true, // 不过滤选项，由外部处理
    options: completions,
  }
}
