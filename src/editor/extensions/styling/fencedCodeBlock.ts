import { syntaxTree } from "@codemirror/language"
import { RangeSetBuilder } from "@codemirror/state"
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, WidgetType } from "@codemirror/view"

const headerClass = "cm-fencedCodeBlockHeader"
const footerClass = "cm-fencedCodeBlockFooter"

class HeaderWidget extends WidgetType {
  constructor(readonly lang: string) { super() }
  toDOM() {
    const dom = document.createElement("span")
    dom.className = headerClass
    dom.textContent = `${this.lang || "code"}`
    return dom
  }
}

class FooterWidget extends WidgetType {
  toDOM() {
    const dom = document.createElement("span")
    dom.className = footerClass
    return dom
  }
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
        const names = ["FencedCode" ];
        if (!names.includes(node.name))
          return;

        // 获取该节点包含的首尾行
        const startLine = view.state.doc.lineAt(node.from);
        const endLine = view.state.doc.lineAt(node.to);

        // 光标在 header/footer 里时，不添加装饰
        const cursorInsideBlockHeaderAndFooter = 
          (cursor >= startLine.from && cursor <= startLine.to) ||
          (cursor >= endLine.from && cursor <= endLine.to);
        if (cursorInsideBlockHeaderAndFooter)
          return;

        // 解析代码块语言
        const firstLineText = view.state.doc.sliceString(startLine.from, startLine.to);
        const match = firstLineText.match(/^````?(\S+)?/);
        const lang = match ? (match[1] || "") : "code";

        builder.add(startLine.from, startLine.to,
          Decoration.replace({ widget: new HeaderWidget(lang), block: false }));
        builder.add(endLine.from, endLine.to,
          Decoration.replace({ widget: new FooterWidget(), block: false }));
      }
    })

    return builder.finish()
  }
}, {
  decorations: v => v.decorations
});

export const fencedCodeBlockVP = theViewPlugin;
