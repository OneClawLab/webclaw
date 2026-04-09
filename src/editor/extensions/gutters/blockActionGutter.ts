import { Logger } from "@lib/logast.js";
import { BlockInfo, EditorView, gutter, GutterMarker } from "@codemirror/view";
import { Extension, RangeSet, RangeSetBuilder } from "@codemirror/state";
import { getFoldableBlockAt } from "@editor/CmUtils.js";
import { hoverHighlightDOMEventHandlers } from "./blockGutterHoverHighlight.js";

// Gutter: 竖条区域，显示在编辑器左侧边
// Marker: gutter 中的标记，可以是图标、数字等
//         通过 RangeSet 存储在 EditorState 中
//         通过 ViewPlugin 动态更新

const defaultGutterClass = "cm-blockActionGutter";
const defaultMarkerClass = "cm-blockActionMarker";

// GutterMarker for BlockActionGutter
class BlockActionGutterMarker extends GutterMarker {
  private svgIcon: string;
  private markerClass: string;

  constructor(svgIcon: string, markerClassName: string = defaultMarkerClass) {
    super();
    this.svgIcon = svgIcon;
    this.markerClass = markerClassName;
  }

  toDOM() {
    const el = document.createElement("span");
    el.innerHTML = this.svgIcon;
    el.className = this.markerClass;
    return el;
  }
}

// 根据当前view/state的状态，创建所需的所有 BlockActionGutterMarkers 实例
function createBlockActionMarkers(view: EditorView, svgIcon: string): RangeSet<GutterMarker> {
  const builder = new RangeSetBuilder<GutterMarker>();
  for (let iter = view.viewport.from; iter <= view.viewport.to; ) {
    const line = view.state.doc.lineAt(iter);
    const block = getFoldableBlockAt(view, line.from, line.to);
    if (block)
      builder.add(line.from, line.from, new BlockActionGutterMarker(svgIcon));
    iter = line.to + 1;
  }
  return builder.finish();
};

type BlockClickHandler = (range: { from: number; to: number }, view: any, event: MouseEvent) => void;

// function createWrapped<ValueType>(value: ValueType) {
//   const funcs = {
//     inc: () => { Logger.debug(value as string); }
//   }
//   return { ...funcs }
// }

function createWrappedDOMEventHandlers(onClick: BlockClickHandler) {
  return {
    mousedown(view: EditorView, line: BlockInfo, event: Event): boolean {
      //Logger.debug("BlockActionGutter mousedown", line.from);
      const block = getFoldableBlockAt(view, line.from, line.to);
      const range = block?.range;
      if (range) {
        //Logger.debug('BlockActionGutter', `Clicked on foldable block: from=${range.from}, to=${range.to}`);
        onClick({ from: range.from, to: range.to }, view, event as MouseEvent);
        event.preventDefault();
        return true;
      }
      Logger.warn("BlockActionGutter clicked but no foldable range:", line.from);
      return false;
    }
  }
}

///////////////////////////////////////////////////////////

export interface BlockActionGutterOptions {
  svgIcon: string;
  onClick: BlockClickHandler;
  gutterClassName?: string;
  markerClassName?: string;
}

// 工厂函数，创建一个类似 foldGutter 的扩展，但点击时执行自定义操作。
export function blockActionGutter(options: BlockActionGutterOptions): Extension {
  return gutter({
    class: options.gutterClassName || defaultGutterClass,
    markers: (view) => createBlockActionMarkers(view, options.svgIcon),
    domEventHandlers: {
      ...createWrappedDOMEventHandlers(options.onClick),
      ...hoverHighlightDOMEventHandlers,
    },
  });
}
