import { EditorState } from "@codemirror/state";

// 提问和回答段落的 开始行的标记
export const lineQ = '--- Q: ---';
export const lineA = '--- A: ---';

// 提问和回答段落的 完整Header
export const headerQ = `${lineQ}\n\n`;
export const headerA = `${lineA}\n\n`;

// 表示一个问答段落在文档中的位置范围
// 如果 type 是 'invalid'，表示不是一个有效的问答段落，此时 textFrom/textTo还是有意义的，而 headerFrom/footerTo 无意义。
export interface ChatSectionRange {
  type: 'question' | 'answer' | 'invalid';
  headerFrom: number;    // lineQ 开始位置 ( --- Q: --- 的行头)
  textFrom: number;      // 问题文本开始位置 (一般位于行头)
  textTo: number;        // 问题文本结束位置 (一般位于行尾)
  footerTo: number;      // chat section 结束位置 (一般位于行尾)，后面是 下一个 chat section 或 文档结尾
}

export const ChatSectionUtils = {
  // 获取文档中最后一组问答段落内容
  getLastChatSection(state: EditorState): ChatSectionRange {
    // TODO 目前这个算法比较粗暴，文档如果很大时，可能会有性能问题
    const docText = state.doc.toString();

    const lastLineQStart = docText.lastIndexOf(lineQ);
    const lastLineAStart = docText.lastIndexOf(lineA);

    if (lastLineQStart === -1 && lastLineAStart === -1) {
      const type = 'invalid';
      const headerFrom = 0;
      const footerTo = state.doc.length;

      const text = docText;
      const leadingSpaces = getLeadingSpaces(text);
      const trailingSpaces = getTrailingSpaces(text);
      const textFrom = leadingSpaces;
      const textTo = text.length - trailingSpaces;

      return { type, headerFrom, textFrom, textTo, footerTo };
    } else {
      const type = lastLineQStart > lastLineAStart ? 'question' : 'answer';
      const headerFrom = Math.max(lastLineQStart, lastLineAStart);
      const footerTo = state.doc.length;

      const _textFrom = headerFrom + lineQ.length; // lineQ 和 lineA 长度相同
      const text = docText.slice(_textFrom, footerTo);
      const leadingSpaces = getLeadingSpaces(text);
      const trailingSpaces = getTrailingSpaces(text);
      const textFrom = _textFrom + leadingSpaces;
      const textTo = footerTo - trailingSpaces;

      return { type, headerFrom, textFrom, textTo, footerTo };
    }
  },
};

export function getLeadingSpaces(text: string): number {
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
      count++;
    } else {
      break;
    }
  }
  return count;
}

export function getTrailingSpaces(text: string): number {
  let count = 0;
  for (let i = text.length - 1; i >= 0; i--) {
    const ch = text.charAt(i);
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
      count++;
    } else {
      break;
    }
  }
  return count;
}

// 判断光标是否在文档的逻辑末尾（即最后一个非空白字符之后的位置）
export function isSelectionAtLogicalEnd(state: EditorState): boolean {
  const { to } = state.selection.main
  const doc = state.doc
  const lineCount = doc.lines

  // 从最后一行往前扫描
  for (let i = lineCount; i >= 1; i--) {
    const line = doc.line(i)
    const text = line.text

    // 如果整行都是空白，继续往前
    if (/^\s*$/.test(text)) continue

    // 找到最后一个非空白字符的索引（相对行起点）
    const lastNonWsIndex = text.search(/\s*$/)
    const logicalEnd = line.from + lastNonWsIndex

    return to >= logicalEnd
  }

  // 文档全是空白，算“在文末”
  return true
}
