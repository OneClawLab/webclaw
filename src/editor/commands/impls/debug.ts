import { Logger } from "@lib/logast.js";
import { defineCommand } from '@editor/commands/registry.js'

import { EditorState } from "@codemirror/state"
import { syntaxTree } from "@codemirror/language"
import { TreeCursor } from "@lezer/common"
import { dispatchAppCommand } from "@commands/registry.js";

// tab/dump 的 EditorCommand Wrapper
defineCommand<{ content: string, title?: string }>({
  id: 'editor/tab/dump',
  title: 'dump content in new tab',
  description: 'show specified content in new tab',
  icon: 'TreePine',
  run(view, args): boolean {
    const { content, title } = args;
    dispatchAppCommand('tab/dump', { content, title });
    return true;
  },
  isActive: (view) => false,
  isEnabled: (view) => true,
});

defineCommand<{void}>({
  id: 'editor/debug/exportSyntaxTree',
  title: 'exportSyntaxTree',
  description: 'export syntax tree of current doc',
  icon: 'TreePine',
  run(view, args): boolean {
    const tree = exportSyntaxTree(view.state);
    const content = '```json\n' + JSON.stringify(tree, null, 2) + '\n```';
    const title = 'Syntax Tree.json';
    dispatchAppCommand('tab/dump', { content, title });
    return true;
  },
  isActive: (view) => false,
  isEnabled: (view) => true,
});

// 将 CodeMirror 6 的语法树导出为普通 JS 对象
function exportSyntaxTree(state: EditorState, from = 0, to = state.doc.length) {
  const tree = syntaxTree(state);
  const cursor = tree.cursor();

  function walk(cursor: TreeCursor): any {
    const node = {
      name: cursor.name,
      from: cursor.from,
      to: cursor.to,
      children: [] as any[],
    };

    if (cursor.firstChild()) {
      do {
        node.children.push(walk(cursor));
      } while (cursor.nextSibling());
      cursor.parent();
    }
    return node;
  }

  return walk(cursor);
}
