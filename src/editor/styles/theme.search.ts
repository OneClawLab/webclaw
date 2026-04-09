import { EditorView } from "@codemirror/view"

/**
 * 搜索面板主题样式
 * 包含搜索和替换面板的所有视觉样式
 */
export const searchPanelTheme = EditorView.theme({
  ////////////////////////////////////////////////////
  // Search Panel Styles (搜索面板样式)
  ////////////////////////////////////////////////////
  
  // 搜索面板容器 - 使用 grid 布局实现紧凑的两行设计
  ".cm-panel.cm-search": {
    backgroundColor: "#f3f3f3",
    border: "none",
    borderBottom: "1px solid #e0e0e0",
    padding: "6px 8px",
    display: "grid",
    gridTemplateColumns: "24px auto auto 1fr auto auto 10px auto", // 第一列固定 24px 宽度，避免按钮注入前布局跳动
    gridTemplateRows: "auto auto",
    gap: "4px 8px",
    alignItems: "center",
  },

  // 覆盖 CodeMirror 默认的 margin，使用 grid gap 控制间距
  ".cm-panel.cm-search input, .cm-panel.cm-search button, .cm-panel.cm-search label": {
    margin: "0",
  },

  // 默认隐藏替换行
  ".cm-panel.cm-search input[name='replace']": {
    display: "none",
  },

  ".cm-panel.cm-search button[name='replace']": {
    display: "none",
  },

  ".cm-panel.cm-search button[name='replaceAll']": {
    display: "none",
  },

  // 展开状态：显示替换行
  ".cm-panel.cm-search.cm-search-replace-expanded input[name='replace']": {
    display: "block",
    gridColumn: "4",
    gridRow: "2",
  },

  ".cm-panel.cm-search.cm-search-replace-expanded button[name='replace']": {
    display: "inline-flex",
    gridColumn: "5",
    gridRow: "2",
    width: "90px",
  },

  ".cm-panel.cm-search.cm-search-replace-expanded button[name='replaceAll']": {
    display: "inline-flex",
    gridColumn: "6",
    gridRow: "2",
    width: "90px",
  },

  // 第一行：[▶] [Aa] [ab] [Find输入框(带计数)] [previous] [next] [×]
  // 第二行：空   空   空   [Replace输入框] [replace] [replace all] 空

  // 展开/收起按钮样式
  ".cm-panel.cm-search .cm-search-toggle-replace": {
    gridColumn: "1",
    gridRow: "1", // 默认只占第一行
    backgroundColor: "transparent",
    border: "1px solid transparent",
    borderRadius: "2px",
    padding: "0",
    width: "24px",
    minWidth: "24px",
    height: "24px", // 固定高度，与其他按钮一致
    cursor: "pointer",
    fontSize: "16px",
    lineHeight: "1",
    color: "#666",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background-color 0.15s ease",
  },

  // 展开状态：按钮占据两行
  ".cm-panel.cm-search.cm-search-replace-expanded .cm-search-toggle-replace": {
    gridRow: "1 / 3", // 展开时占据两行
    height: "100%", // 充满整个 grid 单元格高度
    alignSelf: "stretch", // 拉伸以填充整个网格区域
  },

  // 箭头符号的微调
  ".cm-panel.cm-search .cm-search-toggle-replace span": {
    transform: "translateY(-1px)", // 向上微调 1px，补偿字符基线偏移
  },

  ".cm-panel.cm-search .cm-search-toggle-replace:hover": {
    backgroundColor: "#e0e0e0",
  },

  // 隐藏 regexp 功能（包括 checkbox 和 label）
  ".cm-panel.cm-search label:has(input[name='re'])": {
    display: "none !important",
  },

  // 隐藏 all 按钮（全选功能）
  ".cm-panel.cm-search button[name='select']": {
    display: "none !important",
  },

  // 输入框包装容器
  ".cm-panel.cm-search .cm-search-input-wrapper": {
    gridColumn: "4",
    position: "relative",
    display: "block",
    width: "100%",
  },

  // 输入框样式
  ".cm-panel.cm-search input.cm-textfield": {
    backgroundColor: "white",
    border: "1px solid #e5e5e5", // 淡化边框颜色
    borderRadius: "3px", // 增加圆角
    padding: "3px 8px",
    paddingRight: "70px", // 为右侧计数留出空间
    fontSize: "13px",
    outline: "none",
    minWidth: "0",
    width: "100%",
    boxSizing: "border-box", // 确保宽度计算包含 padding 和 border
    transition: "border-color 0.15s ease", // 添加过渡效果
  },

  ".cm-panel.cm-search input.cm-textfield:focus": {
    border: "1px solid #b0b0b0", // 聚焦时使用更柔和的颜色
    boxShadow: "none", // 移除阴影
  },

  // 搜索输入框在第一行
  ".cm-panel.cm-search .cm-search-input-wrapper:has(input[name='search'])": {
    gridRow: "1",
  },

  // Checkbox 样式 - 隐藏原生 checkbox，用自定义按钮样式
  ".cm-panel.cm-search input[type='checkbox']": {
    appearance: "none",
    width: "24px",
    height: "24px",
    margin: "0",
    backgroundColor: "transparent",
    border: "1px solid transparent",
    borderRadius: "2px",
    cursor: "pointer",
    position: "relative",
    outline: "none",
  },

  ".cm-panel.cm-search input[type='checkbox']:hover": {
    backgroundColor: "#e0e0e0",
  },

  ".cm-panel.cm-search input[type='checkbox']:checked": {
    backgroundColor: "#c5c5c5",
    border: "1px solid #b0b0b0",
  },

  // 使用伪元素显示图标文字
  ".cm-panel.cm-search input[name='case']::before": {
    content: "'Aa'",
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    fontSize: "11px",
    fontWeight: "600",
    color: "#424242",
    pointerEvents: "none", // 允许点击事件穿透到 checkbox
  },

  ".cm-panel.cm-search input[name='word']::before": {
    content: "'ab'",
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    fontSize: "11px",
    fontWeight: "600",
    color: "#424242",
    pointerEvents: "none", // 允许点击事件穿透到 checkbox
  },

  // Label 样式 - 隐藏文字，只显示 checkbox
  ".cm-panel.cm-search label": {
    margin: "0",
    padding: "0",
    fontSize: "0", // 隐藏文字
    display: "flex",
    alignItems: "center",
    position: "relative",
  },
  
  // case 按钮悬浮提示
  ".cm-panel.cm-search label:has(input[name='case']):hover::after": {
    content: "'match case'",
    position: "absolute",
    bottom: "100%", // 从 top 改为 bottom
    left: "0",
    marginBottom: "4px", // 从 marginTop 改为 marginBottom
    backgroundColor: "#333",
    color: "white",
    padding: "4px 8px",
    borderRadius: "4px",
    fontSize: "11px",
    whiteSpace: "nowrap",
    zIndex: "1000",
    pointerEvents: "none",
  },
  
  // word 按钮悬浮提示
  ".cm-panel.cm-search label:has(input[name='word']):hover::after": {
    content: "'by word'",
    position: "absolute",
    bottom: "100%", // 从 top 改为 bottom
    left: "0",
    marginBottom: "4px", // 从 marginTop 改为 marginBottom
    backgroundColor: "#333",
    color: "white",
    padding: "4px 8px",
    borderRadius: "4px",
    fontSize: "11px",
    whiteSpace: "nowrap",
    zIndex: "1000",
    pointerEvents: "none",
  },

  // case 标签在第二列第一行
  ".cm-panel.cm-search label:has(input[name='case'])": {
    gridColumn: "2",
    gridRow: "1",
  },

  // word 标签在第三列第一行
  ".cm-panel.cm-search label:has(input[name='word'])": {
    gridColumn: "3",
    gridRow: "1",
  },

  // 按钮通用样式
  ".cm-panel.cm-search button": {
    backgroundColor: "transparent", // 默认透明背景
    border: "1px solid transparent", // 默认无边框
    borderRadius: "3px",
    padding: "3px 10px",
    fontSize: "12px",
    cursor: "pointer",
    color: "#666", // 更柔和的文字颜色
    height: "24px",
    boxSizing: "border-box", // 确保宽度计算包含 padding 和 border
    whiteSpace: "nowrap",
    display: "inline-flex", // 使用 flex 布局
    alignItems: "center", // 垂直居中
    justifyContent: "center", // 水平居中
    transition: "background-color 0.15s ease, color 0.15s ease", // 添加过渡效果
  },

  ".cm-panel.cm-search button:hover": {
    backgroundColor: "#e8e8e8", // 悬停时浅灰背景
    color: "#333", // 悬停时文字稍微深一点
    border: "1px solid transparent", // 保持无边框
  },

  ".cm-panel.cm-search button:active": {
    backgroundColor: "#d8d8d8",
  },

  // 导航按钮位置和固定宽度
  ".cm-panel.cm-search button[name='prev']": {
    gridColumn: "5",
    gridRow: "1",
    width: "90px",
  },

  ".cm-panel.cm-search button[name='next']": {
    gridColumn: "6",
    gridRow: "1",
    width: "90px",
  },

  // 关闭按钮
  ".cm-panel.cm-search button[name='close']": {
    gridColumn: "8",
    gridRow: "1",
    fontSize: "16px",
    padding: "0",
    width: "24px",
    height: "24px",
    backgroundColor: "transparent",
    border: "1px solid transparent",
  },

  ".cm-panel.cm-search button[name='close']:hover": {
    backgroundColor: "#e0e0e0",
  },

  // br 元素隐藏（不需要换行）
  ".cm-panel.cm-search br": {
    display: "none",
  },

  // 搜索结果计数样式 - 显示在输入框内部右侧
  ".cm-panel.cm-search .cm-search-count": {
    position: "absolute",
    right: "8px",
    top: "50%",
    transform: "translateY(-50%)",
    fontSize: "11px",
    color: "#999",
    whiteSpace: "nowrap",
    pointerEvents: "none", // 不阻挡输入框的点击
    backgroundColor: "white",
    padding: "0 4px",
  },

}, { dark: false })
