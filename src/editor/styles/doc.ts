import { Extension } from "@codemirror/state"
import { syntaxHighlighting, HighlightStyle, defaultHighlightStyle } from "@codemirror/language"

import { tags as t } from "@lezer/highlight"
import { highlightTags as hlt } from "@editor/extensions/markdown/highlightMark.js"

// 参考：@lezer/markdown 中的 styleTags 定义
// const markdownHighlighting = styleTags({
//     "Blockquote/...": tags.quote,
//     HorizontalRule: tags.contentSeparator,
//     "ATXHeading1/... SetextHeading1/...": tags.heading1,
//     "ATXHeading2/... SetextHeading2/...": tags.heading2,
//     "ATXHeading3/...": tags.heading3,
//     "ATXHeading4/...": tags.heading4,
//     "ATXHeading5/...": tags.heading5,
//     "ATXHeading6/...": tags.heading6,
//     "Comment CommentBlock": tags.comment,
//     Escape: tags.escape,
//     Entity: tags.character,
//     "Emphasis/...": tags.emphasis,
//     "StrongEmphasis/...": tags.strong,
//     "Link/... Image/...": tags.link,
//     "OrderedList/... BulletList/...": tags.list,
//     "BlockQuote/...": tags.quote,
//     "InlineCode CodeText": tags.monospace,
//     "URL Autolink": tags.url,
//     "HeaderMark HardBreak QuoteMark ListMark LinkMark EmphasisMark CodeMark": tags.processingInstruction,
//     "CodeInfo LinkLabel": tags.labelName,
//     LinkTitle: tags.string,
//     Paragraph: tags.content
// });

// 定义 Markdown 的样式
const markdownHighlightStyles = HighlightStyle.define([
  // vscodeLightHighlightStyles
  { tag: [t.keyword, t.operatorKeyword, t.modifier, t.color, t.constant(t.name), t.standard(t.name), t.standard(t.tagName), t.special(t.brace), t.atom, t.bool, t.special(t.variableName)], color: "#0000ff" },
  { tag: [t.moduleKeyword, t.controlKeyword], color: "#af00db" },
  { tag: [t.name, t.deleted, t.character, t.macroName, t.propertyName, t.variableName, t.labelName, t.definition(t.name)], color: "#0070c1" },
  { tag: [t.typeName, t.className, t.tagName, t.number, t.changed, t.annotation, t.self, t.namespace], color: "#267f99" },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: "#795e26" },
  { tag: [t.number], color: "#098658" },
  { tag: [t.operator, t.punctuation, t.separator, t.url, t.escape, t.regexp], color: "#383a42" },
  { tag: [t.regexp], color: "#af00db" },
  { tag: [t.special(t.string), t.processingInstruction, t.string, t.inserted], color: "#a31515" },
  { tag: [t.angleBracket], color: "#383a42" },
  { tag: [ t.comment, t.lineComment, t.blockComment ], color: "gray", fontWeight: "300" },
  { tag: [t.meta ], color: "#008000" },
  { tag: t.link, color: "#4078f2", textDecoration: "underline" },
  { tag: t.invalid, color: "#e45649" },

  // Markdown 相关
  { tag: t.heading, fontWeight: "bold", color: "#0070c1" },
  { tag: t.heading1, fontSize: "1.35em", fontWeight: "bold", margin: "1em 0 0.5em 0" },
  { tag: t.heading2, fontSize: "1.30em", fontWeight: "bold", margin: "0.8em 0 0.4em 0" },
  { tag: t.heading3, fontSize: "1.25em", fontWeight: "bold", margin: "0.8em 0 0.4em 0" },
  { tag: t.heading4, fontSize: "1.20em", fontWeight: "bold", margin: "0.8em 0 0.4em 0" },
  { tag: t.heading5, fontSize: "1.15em", fontWeight: "bold", margin: "0.8em 0 0.4em 0" },
  { tag: t.heading6, fontSize: "1.10em", fontWeight: "bold", margin: "0.8em 0 0.4em 0" },
  { tag: t.content, fontSize: "1em", margin: "0.8em 0 0.4em 0" },

  { tag: t.quote, backgroundColor: '#F0F0F0', color: 'black' },

  { tag: t.monospace, color: '#0070c1' }, // 就是 `text`

  { tag: t.strong, fontWeight: "bold" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: hlt.highlight, backgroundColor: 'yellow', color: 'black' },

  // { tag: t.processingInstruction, backgroundColor: 'lightblue', color: 'white' }
]);

export const theDocStyles: Extension = (() => [
  syntaxHighlighting(defaultHighlightStyle, {fallback: true}), // 默认高亮样式（作为回退），为代码添加语法高亮
  syntaxHighlighting(markdownHighlightStyles),    // Markdown 的高亮样式
])();
