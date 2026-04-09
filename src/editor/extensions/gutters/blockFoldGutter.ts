import { RangeSet, RangeSetBuilder } from "@codemirror/state"
import { EditorView, BlockInfo, ViewPlugin, ViewUpdate, gutter, GutterMarker } from "@codemirror/view"
import { codeFolding, language, syntaxTree } from "@codemirror/language"
import { foldable, foldEffect, unfoldEffect, foldState } from "@codemirror/language"
import { svgIcons } from "@editor/styles/svgIcons.js"
import { findFold } from "@editor/CmUtils.js"
import { hoverHighlightDOMEventHandlers } from "./blockGutterHoverHighlight.js"

export type DocRange = {from: number, to: number};

class FoldMarker extends GutterMarker {
  // A function that creates the DOM element used to indicate a given line is folded or can be folded. 
  markerDOM(open: boolean) {
    const wrapper = document.createElement("span")
    wrapper.innerHTML = open ? svgIcons.Collapse : svgIcons.Expand;
    if (!open)
      wrapper.className = "folded"; // for styling
    return wrapper
  }

  constructor(readonly open: boolean) { super() }
  eq(other: FoldMarker) { return this.open == other.open }
  toDOM(view: EditorView) { return this.markerDOM(this.open) }
}

const canFold = new FoldMarker(true);
const canUnfold = new FoldMarker(false);

const foldGutterVP = ViewPlugin.fromClass(
class  {
    markers: RangeSet<FoldMarker>
    from: number

    constructor(view: EditorView) {
      this.from = view.viewport.from
      this.markers = this.buildMarkers(view)
    }

    //@override
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged ||
          update.startState.facet(language) != update.state.facet(language) ||
          update.startState.field(foldState, false) != update.state.field(foldState, false) ||
          syntaxTree(update.startState) != syntaxTree(update.state))
        this.markers = this.buildMarkers(update.view)
    }

    buildMarkers(view: EditorView) {
      const builder = new RangeSetBuilder<FoldMarker>()
      for (const line of view.viewportLineBlocks) {
        const mark = 
            findFold(view.state, line.from, line.to) ? canUnfold
          : foldable(view.state, line.from, line.to) ? canFold : null
        if (mark) builder.add(line.from, line.from, mark)
      }
      return builder.finish()
    }
});

// a FoldConfig with custom placeholderDOM and preparePlaceholder
// see FoldConfig  @codemirror/language/fold.ts
const theFoldConfig = {
  // placeholderDOM?: ((view: EditorView, onclick: (event: Event) => void, prepared: any) => HTMLElement) | null,
  // prepared 是 preparePlaceholder 计算出来的值
  // 这个函数创建折叠块的占位符 DOM 元素
  placeholderDOM: (view, onclick, prepared) => {
    const span = document.createElement("span")

    const dots = prepared as number
    for (let i = 0; i < dots; i++) span.insertAdjacentHTML("beforeend", svgIcons.EllipsisVertical)

    span.className = "cm-foldPlaceholder"
    span.onclick = onclick
    return span
  },

  // 这个函数计算出自定义的值(通常表示被折叠区域的信息)，系统会传给 placeholderDOM 使用
  preparePlaceholder: (state, range) => {
    const len = range.to - range.from;
    const dots = [1,2,3,4,5,6,7,8,9];
    const lens = [20,50,100,200,500,1000,2000,5000];
    for (let i = 0; i < lens.length; i++) {
      if (len <= lens[i]) return dots[i];
    }
    return 9;
  }
}

// click DOMEventHandler
// type DOMEventHandler = (view: EditorView, line: BlockInfo, event: Event) => boolean;
// see Handlers @codemirror/view
function click(view: EditorView, line: BlockInfo, event: Event): boolean {
  let range

  // 已折叠的点击会展开之
  range = findFold(view.state, line.from, line.to)
  if (range) {
    view.dispatch({effects: unfoldEffect.of(range)})
    return true
  }

  // 未折叠的点击会折叠之
  range = foldable(view.state, line.from, line.to)
  if (range) {
    view.dispatch({effects: foldEffect.of(range)})
    return true
  }

  return false
}

function getFoldedTextWithOnlySizingInfo(originalText: string): string {
  const chars = originalText.length;
  const lines = originalText.split("\n").length;

  let desc;
  if (lines <= 1 && chars <= 20)
    desc = originalText;
  else {
    if (lines <= 1)
      desc = `...(${chars} chars)`;
    else
      desc = `...(${lines} lines, ${chars} chars)`;
  }
  return desc;
}

function getFoldedTextWithPreviewTextAndSizingInfo(originalText: string): string {
  const chars = originalText.length;
  const lines = originalText.split("\n").length;

  let desc;
  if (lines <= 1 && chars <= 20)
    desc = originalText;
  else {
    const preview = originalText.slice(0, 20).replace(/\s+/g, ' ');
    const remainChars = chars - preview.length;
    if (lines <= 1)
      desc = `${preview}...(${remainChars} chars)`;
    else
      desc = `${preview}...(${lines} lines, ${chars-preview.length} chars)`;
  }
  return desc;
}

// Create an extension that registers a fold gutter, 
// which shows a fold status indicator before foldable lines
// (which can be clicked to fold or unfold the line).
export const theBlockFoldGutter = [
  // 配置 显式在 Gutter上的 Marker的 ViewPlugin
  foldGutterVP,

  // 配置 核心 折叠功能，以及我们的扩展(折叠后显示Header行末的缩略信息)
  // 注：
  //   这个函数内部还会注入 两个系统内置的 Extension: foldState, baseTheme。
  //   因为 foldState 是一个 fold机制 的核心 StateField，因此我们必须依然调用 系统内置的功能（而不是替换之)。
  codeFolding(theFoldConfig),

  // 配置 用于Fold/Unfold 的 Gutter 本身
  // 主要是 连接我们提供的 Gutter Marker ViewPlugin 以及 click 事件处理器，等。
  // 同时也注入了 hoverHighlightDOMEventHandlers，以便 鼠标 hover能够高亮显示可折叠区域
  gutter({
    class: 'cm-foldGutter',  // 保持和原来一行，以便系统默认的一些样式可以继续生效
    markers(view) { return view.plugin(foldGutterVP)?.markers || RangeSet.empty },
    initialSpacer() { return new FoldMarker(false) },
    domEventHandlers: { click, ...hoverHighlightDOMEventHandlers }
  }),
];
