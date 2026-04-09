import { EditorState } from "@codemirror/state"
import { BlockInfo, EditorView } from "@codemirror/view"
import { foldable, foldState, syntaxTree } from "@codemirror/language"

export type DocRange = {from: number, to: number}
export type DOMEventHandler = (view: EditorView, line: BlockInfo, event: Event) => boolean;
export type DOMEventHandlers = { [event: string]: DOMEventHandler }

// headerIndent markdown 的 foldService 的实现， foldable 函数底层是调用这个来判断的
// import { headerIndent } from "@hack/codemirror/lang-markdown/markdown";

// 获得指定范围对应的 foldable block 范围，无论其是否已折叠
export function getFoldableBlockAt(view: EditorView, from: number, to: number): { range: DocRange, folded: boolean } | null {
  const range = foldable(view.state, from, to);        // 查找所有可折叠区域
  if(!range)
    return null;
  const foldedRange = findFold(view.state, from, to);  // 查找已折叠区域
  const folded = (foldedRange && foldedRange.from === range.from && foldedRange.to === range.to) ?? false;
  return { range, folded };
}

// 找到 包含指定区间的 已折叠区域
export function findFold(state: EditorState, from: number, to: number): DocRange | null {
  let found: {from: number, to: number} | null = null
  state.field(foldState, false)?.between(from, to, (from, to) => {
    if (!found || found.from > from) found = {from, to}
  })
  return found
}

export function isPosInFencedCodeBlock(state: EditorState, pos: number): boolean {
  const tree = syntaxTree(state)

  // 从光标位置找到对应的语法节点
  let node = tree.resolve(pos, -1)

  // 向上爬，直到根节点
  while (node) {
    if (node.name === "FencedCode") 
      return true
    if (!node.parent)
      return false;
    node = node.parent
  }
  return false
}
