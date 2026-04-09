import {EditorView} from "@codemirror/view"

// CodeMirror css class names hierarchy
//
// .cm-editor
//   .cm-scroller
//     .cm-gutters .cm-gutters-before
//       .cm-gutter .cm-lineNumbers
//         .cm-gutterElement [.cm-activeLineGutter] *
//       .cm-gutter .cm-foldGutter
//         .cm-gutterElement [.cm-activeLineGutter] *
//       .cm-gutter .cm-blockActionGutter
//         .cm-gutterElement [.cm-activeLineGutter] *
//            span.cm-blockActionMarker
//     .cm-content [.cm-lineWrapping]
//       .cm-line [.cm-activeLine] [.cm-code-block-bg] *
//         <span> etc *
//       .cm-gap
//     .cm-layer .cm-cursorLayer .cm-layer-above 
//       .cm-cursor .cm-cursor-primary   
//     .cm-layer .cm-selectionLayer

// CodeMirror Editor 主题定制
// 主要控制编辑器语法无关的样式 (如边框、行号、选区等)
// 参见源码：@codemirror/view/theme.ts 里的 baseTheme 定义
const theTheme = EditorView.theme({
  // 最外层编辑器样式
  "&.cm-editor": {
    height: "100%",
    backgroundColor: 'white',
    color: 'black',
    border: "none",
    fontSize: "14px", // 缺省字体大小
    lineHeight: "1.4",
    cursor: "text",
    // 焦点时的样式（去除默认的丑陋蓝色边框）
    "&.cm-focused": {
      outline: "none"
    }
  },

  ".cm-scroller": {
    paddingBottom: "20em",
    // 滚动条样式
    scrollbarWidth: "thin",
    scrollbarColor: "transparent transparent",
    "&::-webkit-scrollbar": {
      width: "8px",
      height: "8px",
    },
    "&::-webkit-scrollbar-track": {
      background: "transparent",
    },
    "&::-webkit-scrollbar-thumb": {
      backgroundColor: "transparent",
      borderRadius: "4px",
      transition: "background-color 0.2s ease",
    },
    "&::-webkit-scrollbar-corner": {
      background: "transparent",
    },
  },

  // 当编辑器获得焦点或悬停时显示滚动条
  "&.cm-focused .cm-scroller": {
    scrollbarColor: "rgba(0, 0, 0, 0.3) transparent",
    "&::-webkit-scrollbar-thumb": {
      backgroundColor: "rgba(0, 0, 0, 0.3)",
    },
    "&::-webkit-scrollbar-thumb:hover": {
      backgroundColor: "rgba(0, 0, 0, 0.5)",
    },
  },

  "&:hover .cm-scroller": {
    scrollbarColor: "rgba(0, 0, 0, 0.3) transparent",
    "&::-webkit-scrollbar-thumb": {
      backgroundColor: "rgba(0, 0, 0, 0.3)",
    },
    "&::-webkit-scrollbar-thumb:hover": {
      backgroundColor: "rgba(0, 0, 0, 0.5)",
    },
  },

  ////////////////////////////////////////////////////

  // 整个Gutter区域的样式
  ".cm-gutters": {
    backgroundColor: 'transparent',
    color: 'black',
    font: "16px 'Fira Code', monospace",
    borderRight: "none"
  },

  // lineNumbers 的样式
  ".cm-lineNumbers .cm-gutterElement": {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end', // 靠右对齐
    height: '100%',
    fontSize: '12px',
    fontWeight: '100',
    color: 'rgba(0, 0, 0, 0.1)', // 行号数字的颜色，半透明
  },
  /* 鼠标悬停时的样式 */
  ".cm-lineNumbers .cm-gutterElement:hover" : {
    opacity: "1",   // 恢复 100% 可见
    color: "blue",  // 悬停时变蓝色
    transform: 'scale(1.2)', // 放大一点
    transition: "opacity 0.3s",
  },

  // foldGutter 的样式
  ".cm-foldGutter": {
    paddingLeft: '2px',
    paddingRight: '2px',
    backgroundColor: 'transparent',
  },
  ".cm-foldGutter .cm-gutterElement": {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'start',
    height: '100%',
    backgroundColor: 'transparent',
    font: "16px 'Fira Code', monospace",
  },
  /* 默认未折叠时的样式 */
  ".cm-foldGutter .cm-gutterElement span" : {
    cursor: "pointer",
    opacity: "0.5",   // 半透明
    color: "gray",    // 默认灰色
    transition: "opacity 0.3s",
  },
  /* 折叠时的样式 */
  ".cm-foldGutter .cm-gutterElement span.folded" : {
    opacity: "1",   // 完全可见
    color: 'black', // 折叠时变黑色
    transition: "opacity 0.3s",
  },
  /* 鼠标悬停时的样式 */
  ".cm-foldGutter .cm-gutterElement span:hover" : {
    opacity: "1",   // 恢复 100% 可见
    color: "blue",  // 悬停时变蓝色
    transform: 'scale(1.5)', // 放大一点
  },
  /* 折叠后行尾的省略符号的样式 */
  ".cm-foldPlaceholder": {
    backgroundColor: "transparent",
    border: "none",
    color: "blue",
    cursor: "pointer",
    whiteSpace: "nowrap",
    display: "inline-flex",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: "4px",
  },
  ".cm-foldPlaceholder svg": {
    opacity: "0.6",
    verticalAlign: "middle",
  },
  /* 鼠标悬停时，折叠后行尾的省略符号的样式 */
  ".cm-foldPlaceholder:hover": {
    backgroundColor: "blue",
    color: "white",
  },
  // 对于已折叠的行，整行显示一个背景
  ".cm-line:has(.cm-foldPlaceholder)": {
    backgroundColor: "#E6F3FF80",
  },

  // BlockActionGutter 的样式
  ".cm-blockActionGutter": {
    paddingLeft: '2px',
    paddingRight: '2px',
    backgroundColor: 'transparent',
  },
  ".cm-blockActionGutter .cm-gutterElement": {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'start',
    height: '100%',
    backgroundColor: 'transparent',
  },
  /* 默认样式 */
  ".cm-blockActionMarker" : {
    cursor: "pointer",
    opacity: "0.1",
    color: 'gray',
    transition: "opacity 0.3s",
  },
  /* 悬停时的样式 */
  ".cm-blockActionMarker:hover" : {
    opacity: "1",   // 恢复 100% 可见
    color: "blue",  // 悬停时变蓝色
    transform: 'scale(1.2)', // 放大一点
  },

  ////////////////////////////////////////////////////

  // 当前行的 Gutter 高亮
  ".cm-activeLineGutter": {
    backgroundColor: 'transparent',
    fontWeight: "bold", // 让当前行号加粗
    color: 'black'
  },
  // 当前行的行号也变颜色
  ".cm-lineNumbers > .cm-gutterElement.cm-activeLineGutter": {
    opacity: "1",
    color: 'black',
  },
  // 当前行的 foldGutter 也变颜色
  ".cm-foldGutter > .cm-gutterElement.cm-activeLineGutter span": {
    opacity: "1",
    color: 'black',
  },
  // 当前行的 BlockActionGutter 也变颜色
  ".cm-activeLineGutter > .cm-blockActionMarker": {
    opacity: "1",
    color: 'black',
  },

  ////////////////////////////////////////////////////

  // 文本内容区域
  ".cm-content": {
    // padding: "1px 1px",
    position: 'relative', // 以便子元素绝对定位时参照
  },

  /* 适用于整个文档的正文，包括 Markdown 的标题、列表等 */
  ".cm-line": {
    fontFamily:  '"Helvetica Neue", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "sans-serif"',
    lineHeight: '1.4',
  },

  // 注：selectionLayer 在 文本 layer 之下。
  // 所以文本块设置背景色时，最好加上一些透明度，避免文本块背景完全遮盖住选区背景。
  // 选区的背景色，编辑器失焦时是这个
  ".cm-selectionBackground": {
    backgroundColor: "#E5EBF1 !important",
  },

 // 当编辑器有焦点时的选区颜色 TODO 这个没用
  "&.cm-focused .cm-selectionBackground": {
    backgroundColor: 'green',
  },

  // 鼠标移到 一个 BlockActionGutter上时，高亮显示该折叠区域的所有行
  ".cm-line.cm-block-hover-highlight": {
    borderRadius: "1px",
    // 因为有些block本来就有背景(比如code block)，所以这里用!important覆盖掉。
    backgroundColor: "rgba(102,170,255,0.1) !important",
    // 但margin不能用!important，否则会覆盖掉 code block 的 margin 导致文字贴边
    // TODO 所以咋办呢？
    // marginLeft: "0px !important",
    marginRight: "4px !important",
  },

  // 定制当前行高亮
  ".cm-activeLine": {
    backgroundColor: "transparent !important",
    // NOTE: outline不能设置只要上下边框；border会导致文字被抬起来；boxShadow完全满足需要。
    boxShadow: "inset 0 2px 0 #40404020, inset 0 -2px 0 #40404020",
  },

  // 配合 blockBackgroundPlugin 使用的代码块背景样式
  ".cm-line.cm-block-bg": {
    borderRadius: "1px",
    marginLeft: "0px",     // TODO 目前和 cm-block-hover-highlight 的 背景在一起会导致背景不对齐问题
    marginRight: "4px",    //      所以暂时把 margin 去掉了 
  },
  // 注: 和 BlockActionGutter hover时加的背景不要冲突。
  ".cm-line.cm-block-bg:not(.cm-block-hover-highlight)": {
    backgroundColor: "rgba(224,224,224,0.2)", // 半透明灰
  },

  // Chat Block Header 的样式
  ".cm-chatBlockHeader": {
    outline: "1px dashed blue",
    width: "calc(100% - 8px)",
    fontWeight: "bold",
    fontSize: "1.2em",
  },
  ".cm-chatBlockHeader.Q": {
    backgroundColor: "rgba(38, 167, 75, 0.05)",  // 半透明绿色
  },
  ".cm-chatBlockHeader.A": {
    backgroundColor: "rgba(255, 167, 38, 0.05)", // 半透明橙色
  },

  // 智能提示的样式
  ".cm-inlineSmartHint": {
    fontStyle: "italic",
    fontWeight: 300,     /* 比 normal(400) 更细 */
    color: '#bbb',       /* 比 lightgray 更淡 */
  },

  // 水平分割线的样式  
  // 注：要保证 光标进入前后 尺寸一致，否则会导致跳动
  ".cm-hrLine": {
    position: "relative",
    color: "transparent",  /* 隐藏原文 */
    display: "block",
    width: "100%",
  },
  ".cm-hrLine::before": {
    content: '""',
    position: "absolute",
    top: "50%",
    left: "0",
    transform: "translateY(-50%)",
    width: "100%",
    height: "1px",
    backgroundColor: "rgba(120,120,120,0.3)",
    margin: "0",
  },

  // Fenced Code Block Header & Footer 的样式
  // 注：要保证 光标进入前后 尺寸一致，否则会导致跳动
  ".cm-fencedCodeBlockHeader": {
    fontSize: "0.9em",
    color: "#888",
    fontStyle: "normal",
    padding: "2px 6px",
    backgroundColor: "transparent",
    borderTopLeftRadius: "4px",
    borderTopRightRadius: "4px",
    borderBottom: "1px solid #ddd",
  },
  ".cm-fencedCodeBlockFooter": {
    fontSize: "0.9em",
    color: "#888",
    backgroundColor: "transparent",
    textAlign: "center",
    padding: "2px 0",
    borderBottomLeftRadius: "4px",
    borderBottomRightRadius: "4px",
    borderTop: "1px solid #ddd",
  },

  ".cm-rsLink, .cm-refLink, .cm-urlLink": {
    color: '#0059c9',
    textDecoration: 'underline',
    textDecorationThickness: '0.8px',
    textUnderlineOffset: '2px',
    textDecorationColor: 'rgba(183, 122, 0, 0.35)',
    cursor: "pointer",
  },
  ".cm-rsLink:hover, .cm-refLink:hover, .cm-urlLink:hover": {
    textDecoration: "underline",
    filter: "brightness(0.65)",
  },

  ////////////////////////////////////////////////////
  // Markdown Image widget styles (for imageExtension widgets)
  ////////////////////////////////////////////////////

  // 隐藏 image widget 相邻的 widgetBuffer
  ".cm-md-image-wrapper + .cm-widgetBuffer, .cm-widgetBuffer:has(+ .cm-md-image-wrapper)": {
    display: "none !important",
    height: "0 !important",
    width: "0 !important",
  },

  ".cm-md-image-wrapper": {
    margin: "0",
    display: "block",
    maxWidth: "100%",
    cursor: "pointer",
    textAlign: "left",
  },
  
  ".cm-md-image-wrapper img": {
    borderRadius: "4px",
    objectFit: "contain",
    display: "block",
    marginLeft: "0",
    marginRight: "auto",
  },
  
  ".cm-md-image-caption": {
    textAlign: "center !important",
    width: "100%",
  },

  ////////////////////////////////////////////////////
  // Markdown Table widget styles (for tableExtension widgets)
  ////////////////////////////////////////////////////

  // 隐藏 table widget 相邻的 widgetBuffer
  ".cm-md-table-wrapper + .cm-widgetBuffer, .cm-widgetBuffer:has(+ .cm-md-table-wrapper)": {
    display: "none !important",
    height: "0 !important",
    width: "0 !important",
  },

  ".cm-md-table-wrapper": {
    display: "inline-block",
    position: "relative",
    margin: "0",
    padding: "0",
    maxWidth: "100%",
    width: "100%",
    boxSizing: "border-box",
  },

  "table.cm-md-table": {
    width: "fit-content",
    maxWidth: "calc(100% - 1rem)",
    boxSizing: "border-box",
    minWidth: 0,
    tableLayout: "auto",

    borderCollapse: "collapse",
    borderSpacing: "0",

    font: "inherit",
    fontSize: "inherit",
    lineHeight: "inherit",
    background: "transparent",
  },

  "table.cm-md-table th, table.cm-md-table td": {
    boxSizing: "border-box",
    maxWidth: "100%",
    minWidth: 0,    

    border: "1px solid rgba(128, 128, 128, 0.35)",
    padding: "4px 8px",
    verticalAlign: "top",

    // 允许折行
    whiteSpace: "normal",

    // 允许长词/长 URL 断行
    overflowWrap: "anywhere",
    wordBreak: "break-word",
  },

  "table.cm-md-table th": {
    fontWeight: "600",
    background: "rgba(128, 128, 128, 0.15)",
  },

  "table.cm-md-table tr:nth-child(even) td": {
    background: "rgba(128, 128, 128, 0.06)",
  },

  "table.cm-md-table tr:hover td": {
    background: "rgba(128, 128, 128, 0.10)",
  },

}, {dark: false});

export { theTheme };
