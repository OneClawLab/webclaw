import { Logger } from "@lib/logast.js";
import { EditorState, Extension, RangeSetBuilder, StateField } from "@codemirror/state";
import { EditorView, Decoration, DecorationSet } from "@codemirror/view";
import { foldService } from "@codemirror/language";
import { MarkdownExtension, BlockContext, Line } from "@lezer/markdown";
import { tags as t } from "@lezer/highlight";

// 规则： 必须以 --- 开头和结尾，中间有空格，且包含一个标识符，标识符可以是字母、数字、下划线、连字符或冒号
// 这个 regex 的捕获组 (match[1]) 是 标识符部分
export const chatBlockHeaderRegex = /^---\s+([A-Za-z0-9:_-]+)\s+---$/;
// markdown syntax node name for chat block header
export const chatBlockSyntaxNodeName = "ChatBlockHeading";
const headerClass = "cm-chatBlockHeader";

// chat block's markdown extension, to recognize chat block headers
export const chatBlockHeaderMDEXT: MarkdownExtension = {
  defineNodes: [
    { name: chatBlockSyntaxNodeName, style: t.heading1, block: true },
  ],
  parseBlock: [
    {
      name: chatBlockSyntaxNodeName,
      parse(cx: BlockContext, line: Line) {
        const match = chatBlockHeaderRegex.exec(line.text);
        if (!match) return false;
        // Logger.debug("Found ChatBlockHeader:", match[1]);
        const el = cx.elt(chatBlockSyntaxNodeName, cx.lineStart, cx.lineStart + line.text.length);
        cx.addElement(el);
        cx.nextLine(); // 移动到下一行
        return true;
      },
    },
  ],
};

type ChatBlockRange = { type: 'Q' | 'A', headerLine: number; startLine: number; endLine: number };

// chat block's state field extension
const chatBlockStateField = StateField.define<ChatBlockRange[]>({
  create(state) {
    return buildChatBlockIndex(state);
  },
  update(value, tr) {
    if (!tr.docChanged) return value;
    return buildChatBlockIndex(tr.state);
  },
});

function buildChatBlockIndex(state: EditorState): ChatBlockRange[] {
  const result: ChatBlockRange[] = [];
  const doc = state.doc;

  for (let lineNum = 1; lineNum <= doc.lines; lineNum++) {
    const line = doc.line(lineNum);
    const match = chatBlockHeaderRegex.exec(line.text);
    if (!match) continue;

    const type = match[1].startsWith('Q') ? 'Q' : 'A';
    const headerLine = lineNum;
    const startLine = lineNum + 1; // 内容从 header 下一行开始
    let endLine = doc.lines;

    for (let l = lineNum + 1; l <= doc.lines; l++) {
      const text = doc.line(l).text;
      if (chatBlockHeaderRegex.test(text)) {
        endLine = l - 1;
        break;
      }
    }

    // 只有包含内容的块才有意义
    if (startLine <= endLine)
      result.push({ type, headerLine, startLine, endLine });
  }

  return result;
}

// chat block's fold service extension
const chatBlockFoldServiceExtension: Extension = foldService.of((state, lineStart) => {
  const ranges = state.field(chatBlockStateField, false);
  if (!ranges) return null;

  for (const r of ranges) {
    const headerLine = state.doc.line(r.headerLine);
    if (headerLine.from === lineStart) {
      // 折叠区域从 header 行结束后开始
      const from = headerLine.to;
      const to = state.doc.line(r.endLine).to;
      if (from >= to) return null;
      return { from, to };
    }
  }

  return null;
});

// chat block's header line highlight extension
const chatBlockHeaderHighlight: Extension = StateField.define<DecorationSet>({
  create(state) {
    return buildDecorations(state);
  },
  update(deco, tr) {
    if (!tr.docChanged) return deco;
    return buildDecorations(tr.state);
  },
  provide: f => EditorView.decorations.from(f),
});

function buildDecorations(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const ranges = state.field(chatBlockStateField, false) || [];
  for (const r of ranges) {
    const line = state.doc.line(r.headerLine);
    builder.add(line.from, line.from,
      Decoration.line({ class: headerClass + ' ' + r.type })); // 加一个 type class Q 或 A
  }
  return builder.finish();
}

// Helper function to check if a line number is a chat block header line
export function isChatBlockHeaderLine(state: EditorState, lineNumber: number): boolean {
  const ranges = state.field(chatBlockStateField, false) || [];
  return ranges.some(r => r.headerLine === lineNumber);
}

// The main extension that combines all chat block related features
export const foldableChatBlock: Extension = [
  chatBlockStateField,
  chatBlockFoldServiceExtension,
  chatBlockHeaderHighlight,
];
