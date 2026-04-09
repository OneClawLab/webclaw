import { Logger } from "@lib/logast.js";
import { svgIcons } from "@editor/styles/svgIcons.js";
import { truncateMiddle } from "@lib/utils.js";
import { blockActionGutter } from "./blockActionGutter.js";
import { lineA, lineQ } from "@editor/ChatSectionUtils.js";

// a BlockClickHandler for copying block content to clipboard
function onClickBlockCopy(range: { from: number; to: number }, view: any, event: MouseEvent) {
  // 找到 header 行 (range.from是在header行的末尾位置)
  const headerLine = view.state.doc.lineAt(range.from);

  // 复制 header 行 + 内容
  let text: string = view.state.doc.sliceString(headerLine.from, range.to);

  // 如果是代码块，不要拷贝起止标记
  if (text.startsWith('```')) {
    const startIndex = text.indexOf('\n'); // 跳过 整个 ``` 行，因为后面可能有语言标记
    const endIndex = text.lastIndexOf('\n```'); // 找到结束标记的前一行末尾
    text = text.slice(
      startIndex >= 0 ? startIndex + 1 : 0,
      endIndex >= 0 ? endIndex : text.length);
  // 如果是问答块，不要拷贝起始标记
  } else if (text.startsWith(lineQ) || text.startsWith(lineA)) {
    text = text.slice(lineQ.length + 1, text.length); // lineQ 和 lineA 长度相同
  }

  // 去除开头的任何空白字符。
  // 结尾的空白字符，如果是单行文本，则全部去除，如果是多行文本，替换为一个换行符。
  const leadingSpaces = text.match(/^\s*/)!;
  const trailingSpaces = text.match(/\s*$/)!;
  text = text.slice(leadingSpaces[0].length, text.length - trailingSpaces[0].length);
  // 如果是多行文本，结尾保证有一个换行符
  if (text.includes('\n')) text = text + '\n';

  navigator.clipboard.writeText(text);
  Logger.debug('theBlockCopyGutter', `block text copied to clipboard: ${truncateMiddle(text)}`);
}

export const theBlockCopyGutter = blockActionGutter({
  svgIcon: svgIcons.Copy,
  onClick: onClickBlockCopy,
});
