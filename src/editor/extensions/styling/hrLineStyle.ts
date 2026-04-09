import { syntaxTree } from "@codemirror/language"
import { RangeSetBuilder } from "@codemirror/state"
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, WidgetType } from "@codemirror/view"

const headerClass = "cm-hrLine"

class HeaderWidget extends WidgetType {
  constructor() { super() }
  toDOM() {
    const dom = document.createElement("span")
    dom.className = headerClass
    dom.textContent = "\u200b"; // 零宽字符占位
    return dom
  }
  ignoreEvent(event: Event): boolean { return false; }
}

const theViewPlugin = ViewPlugin.fromClass(class {
  decorations: DecorationSet

  constructor(view: EditorView) {
    this.decorations = this.buildDecorations(view)
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.selectionSet)
      this.decorations = this.buildDecorations(update.view)
  }

  buildDecorations(view: EditorView) {
    const builder = new RangeSetBuilder<Decoration>();
    const cursor = view.state.selection.main.head;

    const tree = syntaxTree(view.state);
    tree.iterate({
      enter: (node) => {
        const names = ["HorizontalRule" ];
        if (!names.includes(node.name))
          return;

        // 光标在 节点内时，不添加装饰
        const cursorInside = cursor >= node.from && cursor <= node.to;
        if (cursorInside) {
          // Logger.debug("hrLineVP: cursor inside hr line, skip decoration at ", node.from, node.to);
          return;
        }

        // Logger.debug("hrLineVP: adding hr line decoration at ", node.from, node.to);
        builder.add(node.from, node.to, Decoration.mark({ class: "cm-hrLine"}));
      }
    })

    return builder.finish()
  }
}, {
  decorations: v => v.decorations
});

export const hrLineVP = theViewPlugin;
