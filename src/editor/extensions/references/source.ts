import { CompletionSource } from '@codemirror/autocomplete';
import { getCompletions } from './completions.js';

/**
 * 用于在光标前（matchBefore）识别“@引用”前缀的正则：
 * - 以 @ 开头
 * - 可以用/分隔多段字符
 * - 每一段允许包含任意非空白、非终止字符
 * - 终止字符为: 空白字符、右括号、标点符号等
 */
export const REF_MATCH_BEFORE_REGEX = /@[^\s)\]}）】·,，。．？?！!]*/u;

// @引用的 CompletionSource
export const refCompletionSource: CompletionSource = (ctx) => {
  // 在光标前查找最近的、满足 REF_MATCH_BEFORE_REGEX 的片段
  // match.text: 被匹配到的内容（例如 "@kb", "@kb/foo"）
  // match.from: 该片段在文档中的起始位置
  const match = ctx.matchBefore(REF_MATCH_BEFORE_REGEX);
  if (!match) return null; // 光标前没有 @ 引用 token，不触发补全

  const text = match.text.slice(1); // 去掉 @

  // 解析出已经输入完整的 segments 列表
  const segments = text.split('/');
  // 去掉最后一个不完整的 segment
  const lastSegment = segments.pop()!;

  const lastSlash = match.text.lastIndexOf('/');
  const from = lastSlash === -1 ?
      match.from                   // @ 之前
    : match.from + lastSlash + 1;  // 最后一个 / 之后

  const result = getCompletions(segments, lastSegment);
  // 没有补全项，或者补全已经完整(且没有子项)，就不需要再补全了
  if (!result || result.isComplete || result.options.length === 0) return null;

  return {
    from, 
    options: result.options,
    filter: false, // 关闭 CodeMirror 的内置过滤，让我们自己控制
  };
};
