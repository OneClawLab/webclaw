// markdown ==文字== 高亮扩展

import { tags as t, Tag } from "@lezer/highlight";
import { MarkdownConfig } from '@lezer/markdown'

// --- 1. 定义自定义高亮标签 (Tag) ---
// CodeMirror 6 中没有默认的 highlight 标签，所以我们自定义一个
export const highlightTags = {
  highlight: Tag.define(t.emphasis), // 派生自 emphasis，以便在无特殊样式时回退到斜体
};

// --- 2. 定义解析器的配置 ---
// 用于识别 == 分隔符
const HighlightDelim = {
  resolve: 'Highlight',  // 解析成功后生成的节点名称
  mark: 'HighlightMark', // 分隔符本身的节点名称 (==)
};

// 配置解析规则
export const highlightMDEXT: MarkdownConfig = {
  // 定义新的节点类型，用于 CodeMirror 的语法树
  defineNodes: [
    { name: 'Highlight', style: { 'Highlight/...': highlightTags.highlight } },
    { name: 'HighlightMark', style: t.processingInstruction }
  ],
  // 添加新的内联解析规则
  parseInline: [{
    name: 'Highlight',
    // 定义起始和结束标记
    // 标记必须是两个字符，且非字母数字
    // resolve: 'Highlight' 告诉解析器，用 HighlightDelim 来处理解析到的内容
    // mark: '=='
    parse(cx, next, pos) {
      if (next != 61 /* '=' */ || cx.char(pos + 1) != 61 ||  cx.char(pos + 2) == 61) return -1;
      return cx.addDelimiter(HighlightDelim, pos, pos + 2, true, true );
    },
    after: 'Emphasis' 
  }]
};
