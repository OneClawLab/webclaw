import { 
  EditorView,  
  dropCursor, crosshairCursor, 
  drawSelection, lineNumbers, 
  highlightActiveLine, highlightActiveLineGutter, highlightSpecialChars
} from "@codemirror/view"

import { Extension} from "@codemirror/state"
import { indentOnInput, bracketMatching } from "@codemirror/language"
import { history } from "@codemirror/commands"
import { highlightSelectionMatches} from "@codemirror/search"
import { autocompletion, closeBrackets } from "@codemirror/autocomplete"
import { markdown, markdownLanguage } from "@hack/codemirror/lang-markdown/index.js"

import { theCodeLanguages } from "./extensions/codeLanguages.js"
import { theKeymap } from "./extensions/keymap.js"

import { highlightMDEXT } from "./extensions/markdown/highlightMark.js"
import { foldableChatBlock, chatBlockHeaderMDEXT } from "./extensions/markdown/foldableChatBlock.js"

import { blockBackgroundVP } from "./extensions/styling/blockBackground.js"
import { theBlockFoldGutter } from "./extensions/gutters/blockFoldGutter.js"
import { blockGutterHoverHighlightVP } from "./extensions/gutters/blockGutterHoverHighlight.js"
import { theBlockCopyGutter } from "./extensions/gutters/blockCopyGutter.js"

import { theTheme } from './styles/theme.js'
import { theDocStyles } from './styles/doc.js'
import { searchPanelTheme } from './styles/theme.search.js'
import { scrollPadding } from "./extensions/scrollPadding.js"
import { autoCompletion } from "./extensions/autoCompletion.js"
import { inlineSmartHintVP } from "./extensions/inlineSmartHint.js"
import { autocompletionTheme } from "./styles/theme.autocompletion.js"
import { tableExtension } from "./extensions/table/extension.js"
import { linkClickHandlers, linkHighlighters } from "./extensions/links/extension.js"
import { fencedCodeBlockVP } from "./extensions/styling/fencedCodeBlock.js"
import { hrLineVP } from "./extensions/styling/hrLineStyle.js"
import { headerMarksVP } from "./extensions/styling/headerMarks.js"
import { inlineMarksVP } from "./extensions/styling/inlineMarks.js"
import { imageExtension } from "./extensions/image/extension.js"
import { checklistVP } from "./extensions/checklist/extension.js"
import { searchResultCounter } from "./extensions/search/plugins/resultCounter.js"
import { replaceToggle } from "./extensions/search/plugins/replaceToggle.js"
import { searchBehavior } from "./extensions/search/listeners/searchBehavior.js"

// 禁用一些过时的 markdown 语法：
//   SetextHeading 语法
//   IndentedCode 语法
//   LinkReference 语法
//   HTMLBlock 语法
const disableSomeMarkdownSyntax = {
  defineNodes: [],
  remove: ['SetextHeading', 'IndentedCode', 'HTMLBlock', 'LinkReference'] 
};

// 是否启用行号显示，默认为不启用
const SUPPORT_LINE_NUMBERS = false;

export const basicSetup: Extension = (() => [
  SUPPORT_LINE_NUMBERS ? lineNumbers() : [],               // 行号，显示每行的行号
  SUPPORT_LINE_NUMBERS ? highlightActiveLineGutter() : [], // 活动行行号高亮，突出显示当前行的行号

  blockGutterHoverHighlightVP, // 鼠标悬停时高亮显示折叠块
  theBlockFoldGutter, // 显示可折叠块的标记
  theBlockCopyGutter, // 显示可拷贝块的标记

  // 自定义选区绘制，相比缺省浏览器选区，可以整行都显示出背景
  drawSelection(),
  
  history(),       // Undo/Redo支持

  indentOnInput(), // 输入时重新缩进，自动根据语法缩进代码

  highlightActiveLine(),       // 活动行高亮，高亮显示当前编辑的行
  highlightSelectionMatches(), // 选区匹配高亮，高亮显示与选区内容相同的文本
  highlightSpecialChars(),     // 特殊字符高亮，显示不可见字符如空格和制表符
  bracketMatching(),           // 括号匹配，高亮显示匹配的括号
  closeBrackets(),             // 括号自动闭合，输入左括号时自动补全右括号

  dropCursor(),       // 拖放光标，拖拽文本时显示插入位置
  crosshairCursor(),  // 十字准星光标，选区时显示十字光标辅助定位

  theKeymap,          // 键盘快捷键绑定，绑定常用编辑快捷键

  EditorView.lineWrapping,

  // 语言扩展，这里我们只启用 Markdown，不含嵌入的其他程序语言
  markdown({ 
    base: markdownLanguage,
    codeLanguages: theCodeLanguages,
    extensions: [
      disableSomeMarkdownSyntax,  // 禁用一些过时的 markdown 语法
      highlightMDEXT,             // ==高亮== 扩展
      chatBlockHeaderMDEXT,       // Markdown语言扩展 里的 Chat Block 扩展
    ]
  }),

  // 智能提示菜单的样式
  autocompletionTheme,
  // 文档样式，主要控制文档内容语法相关的样式 (如Markdown)
  theDocStyles,
  // main 主题样式，主要控制编辑器语法无关的样式 (如边框、行号、选区等)
  theTheme,
  // 搜索面板主题样式
  searchPanelTheme,

  blockBackgroundVP,    // 各种块背景插件(Fenced Code, Table等)
  hrLineVP,             // hr line 样式扩展
  fencedCodeBlockVP,    // fenced code block 样式扩展
  headerMarksVP,        // 隐藏 Markdown Header 的 # 符号扩展
  inlineMarksVP,        // 隐藏 inline marks (如 **bold**, `code`) 的扩展

  ...tableExtension,    // table 渲染扩展
  imageExtension,       // image 渲染扩展
  checklistVP,          // checklist 渲染扩展

  ...linkHighlighters,  // 各种链接高亮扩展
  ...linkClickHandlers, // 各种链接点击处理扩展

  // 解析并支持 chat block section, 以及使之可折叠
  foldableChatBlock,

  scrollPadding(),      // VS Code 风格的光标滚动逻辑

  autoCompletion(),     // 命令触发扩展，包含 "/" 和 "@" 两种触发器
  inlineSmartHintVP,    // inline 智能提示扩展
  
  searchResultCounter,  // 搜索结果计数显示
  searchBehavior,       // 搜索行为增强
  replaceToggle,        // 替换行展开/收起
])();

