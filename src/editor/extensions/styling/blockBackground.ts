import { syntaxTree } from "@codemirror/language"
import { EditorView, Decoration, ViewPlugin, DecorationSet, ViewUpdate } from "@codemirror/view"
import { RangeSetBuilder } from "@codemirror/state"

// 创建一个 给指定Block整体加个背景的 ViewPlugin
export const blockBackgroundVP = ViewPlugin.fromClass(class {
  decorations: DecorationSet

  constructor(view: EditorView) {
    this.decorations = this.buildDecorations(view)
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.viewportChanged)
      this.decorations = this.buildDecorations(update.view)
  }

  buildDecorations(view: EditorView): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>()
    const tree = syntaxTree(view.state)

    tree.iterate({
      enter: (node) => {
        //const names = ["FencedCode", "CodeBlock", 'HorizontalRule', 'Table']; // "OrderedList", "BulletList", 
        const names = ["FencedCode" ];
        if (!names.includes(node.name))
          return;

        // 获取该节点包含的所有行
        const startLine = view.state.doc.lineAt(node.from)
        const endLine = view.state.doc.lineAt(node.to)

        // 给每一行添加背景装饰
        for (let lineNo = startLine.number; lineNo <= endLine.number; lineNo++) {
          const line = view.state.doc.line(lineNo);
          builder.add(line.from, line.from,
            Decoration.line({ attributes: { class: "cm-block-bg" } }));
        }
      }
    })

    return builder.finish()
  }
}, {
  decorations: v => v.decorations
});
