/* eslint-disable prefer-const */
import {Language, defineLanguageFacet, languageDataProp, foldNodeProp, indentNodeProp, foldService,
        syntaxTree, LanguageDescription, ParseContext} from "@codemirror/language"
import {parser as baseParser, MarkdownParser, GFM, Subscript, Superscript, Emoji} from "@lezer/markdown"
import {SyntaxNode, NodeType, NodeProp} from "@lezer/common"
import { EditorState } from "@codemirror/state"
import { isChatBlockHeaderLine } from "@editor/extensions/markdown/foldableChatBlock.js"

const data = defineLanguageFacet({commentTokens: {block: {open: "<!--", close: "-->"}}})

const headingProp = new NodeProp<number>()

const commonmark = baseParser.configure({
  props: [
    foldNodeProp.add(type => {
      return !type.is("Block") || type.is("Document") || isHeading(type) != null || isList(type) ? undefined
        : (tree, state) => ({from: state.doc.lineAt(tree.from).to, to: tree.to})
    }),
    headingProp.add(isHeading),
    indentNodeProp.add({
      Document: () => null
    }),
    languageDataProp.add({
      Document: data
    })
  ]
})

const extended = commonmark.configure([GFM, Subscript, Superscript, Emoji, {
  props: [
    foldNodeProp.add({
      Table: (tree, state) => ({from: state.doc.lineAt(tree.from).to, to: tree.to})
    })
  ]
}])

export function mkLang(parser: MarkdownParser) {
  return new Language(data, parser, [], "markdown")
}

/// Language support for [GFM](https://github.github.com/gfm/) plus
/// subscript, superscript, and emoji syntax.
export const markdownLanguage = mkLang(extended)

function isHeading(type: NodeType) {
  let match = /^(?:ATX|Setext)Heading(\d)$/.exec(type.name)
  return match ? +match[1] : undefined
}

function isList(type: NodeType) {
  return type.name == "OrderedList" || type.name == "BulletList"
}

function findSectionEnd(headerNode: SyntaxNode, level: number, state: EditorState) {
  let last = headerNode
  for (;;) {
    let next = last.nextSibling
    if (!next) break
    
    // 判断是否 ChatBlock header 行
    const line = state.doc.lineAt(next.from);
    if (isChatBlockHeaderLine(state, line.number)) break;

    let heading
    if ((heading = isHeading(next.type)) != null && heading <= level) break
    last = next
  }
  return last.to
}

// Markdown 的 foldService 实现
export const headerIndent = foldService.of((state, start, end) => {
  return findHeadingSection(state, start, end)?.range || null;
});

// 返回包裹 start~end 范围的 heading section 的范围 和 level (几个#号)
export function findHeadingSection(state: EditorState, start: number, end: number): { range: { from: number, to: number }, level: number } | null {
  let tree = syntaxTree(state)
  let node: SyntaxNode | null = tree.resolveInner(end, -1)

  // 从 end 位置所在的节点开始，沿着树父节点找，找到第一个 覆盖了 start~to 区间的 heading section
  for (; node; node = node.parent) {
    if (node.from < start) 
      break    // 已经超出范围了，没找到
    let level = node.type.prop(headingProp)
    if (level == null) 
      continue // 不是 heading 节点, 沿着树往父节点找
    let upto = findSectionEnd(node, level, state)
    if (upto > end)  // 找到了一个 heading 节点，其 范围覆盖了 end 位置
      return { range: { from: end, to: upto }, level };
  }
  return null
}

export function getCodeParser(
  languages: readonly LanguageDescription[] | ((info: string) => Language | LanguageDescription | null) | undefined,
  defaultLanguage?: Language
) {
  return (info: string) => {
    if (info && languages) {
      let found: any = null
      // Strip anything after whitespace
      info = /\S*/.exec(info)![0]
      if (typeof languages == "function") found = languages(info)
      else found = LanguageDescription.matchLanguageName(languages, info, true)
      if (found instanceof LanguageDescription)
        return found.support ? found.support.language.parser : ParseContext.getSkippingParser(found.load())
      else if (found)
        return found.parser
    }
    return defaultLanguage ? defaultLanguage.parser : null
  }
}
