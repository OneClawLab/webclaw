import { Logger, Assert } from "@lib/logast.js"
import { StateEffect, EditorState } from "@codemirror/state"
import { foldEffect, unfoldEffect, syntaxTree } from "@codemirror/language"
import { Command, EditorView } from "@codemirror/view"
import { SyntaxNode, Tree } from "@lezer/common"
import { getFoldableBlockAt } from "@editor/CmUtils.js"
import { chatBlockSyntaxNodeName } from "./markdown/foldableChatBlock.js"

// Visible Level: 越低显示的内容越少
//  -1 - 折叠 ChatBlock (只留顶层各块的Header行可见)
//   0 - 展开到 ChatBlock (Header及其顶层文字可见，其子节点被折叠为各自一行)
//   1~6 - 展开到 Heading1~6 (该Heading的首行及其顶层文字可见，其子节点被折叠为各自一行)
//   7 - 展开所有 (所有细节全部展开)

// SyntaxTree.resolve() 只能取得最底层的节点，这里尝试往上找一些更高层的节点
function resolveSyntaxNode(tree: Tree, pos: number): SyntaxNode {
  const node = tree.resolveInner(pos, 1);  // 1: prefer right side open nodes
  if (node.type.name === chatBlockSyntaxNodeName)
    return node;
  else if (node.type.name.startsWith('ATXHeading'))
    return node;
  else if (node.type.name === 'HeaderMark') {
    const headerNode = node.parent;
    Assert.isTrue(headerNode && headerNode.type.name.startsWith('ATXHeading'));
    return headerNode!;
  } else if (node.type.name === 'TableDelimiter' || 
             node.type.name.endsWith('Mark')) {
    // 这些节点本身没有层级定义，往上找父节点, TODO 这里只是随便列举了一些。
    const parent = node.parent;
    Assert.notNull(parent);
    return parent!;
  } else
    return node;
}

// 节点所在层级：0~7，数字越小层级越高，和 Visible Level 对应
function getNodeLevel(state: EditorState, node: SyntaxNode): number {
  if (node.type.name === chatBlockSyntaxNodeName)
    return 0
  if (node.type.name.startsWith('ATXHeading')) {
    const level = node.type.name.slice('ATXHeading'.length);
    const levelNum = parseInt(level);
    if (!isNaN(levelNum) && levelNum >= 1 && levelNum <= 6)
      return levelNum;
    Assert.fail(`Invalid heading level: ${level}`);
  }
  return 7; // 该节点没有层级定义，或者层级低于我们定义的所有层级
}

type FoldableBlockInfo = { level: number; name: string; folded: boolean; range: { from: number; to: number } };

export function getFoldableBlocks(view: EditorView)
  : FoldableBlockInfo[]
{
  const blocks = [] as any[];
  const foldableLines = new Set<number>();

  const state = view.state;
  const tree = syntaxTree(state);

  for (let pos = 0; pos < state.doc.length; ) {
    const lineInfo = state.doc.lineAt(pos);

    const node = resolveSyntaxNode(tree, lineInfo.from);
    const nodeLevel = getNodeLevel(state, node);

    const block = getFoldableBlockAt(view, lineInfo.from, lineInfo.to);

    if (block && !foldableLines.has(lineInfo.number)) {
      foldableLines.add(lineInfo.number);
      blocks.push({ level: nodeLevel, name: node.type.name, folded: block.folded, range: block.range });
    }
    pos = lineInfo.to + 1; // 跳过一个(逻辑)自然行
  }
  return blocks;
}

// 设置 Visible Level，并折叠相应层级的节点
// level的意思是：所有 level > 该值的节点都被折叠，所有 level <= 该值的节点都被展开
function setVisibleLevel(view: EditorView, blocks: FoldableBlockInfo[], level: number) {
  // Logger.debug(`Total foldable blocks: ${blocks.length}`);
  // for (const b of blocks) {
  //   const indent = '--'.repeat(b.level);
  //   Logger.debug(`${indent} level=${b.level}, name=${b.name}, range=${b.range.from}..${b.range.to}, ${b.folded ? 'folded' : ''}`);
  // }

  //Logger.debug(`setVisibleLevel: level=${level}`);

  const effects: StateEffect<any>[] = [];

  for (const block of blocks) {
    // 可折叠区域应该可见，但当前被折叠，则展开之
    if (block.level <= level && block.folded) {
      //Logger.debug(`{{{  unfold range: ${block.range.from}..${block.range.to}`);
      effects.push(unfoldEffect.of(block.range));
    // 可折叠区域应该不可见，但当前未被折叠，则折叠之
    } else if (block.level > level && !block.folded) {
      //Logger.debug(`}}}  fold range: ${block.range.from}..${block.range.to}`);
      effects.push(foldEffect.of(block.range));
    }
  }

  if (effects.length)
    view.dispatch({ effects })
}

// // 找出当前 editor中实际的 Visible Level，以及有效的(实际存在的) 前后 两级的 Visible Level
// export function findVisibleLevels(view: EditorView): { current: number, prev: number, next: number } {
//   const blocks = getFoldableBlocks(view);
//   let current = 7, prev = 7, next = -1;

//   for (const block of blocks) {
//     if (!block.folded) {
//       // 找出当前实际的 Visible Level
//       if (block.level < current)
//         current = block.level;
//     } else {
//       // 找出有效的(实际存在的) 前后 两级的 Visible Level
//       if (block.level < next || next === -1)
//         next = block.level;
//       if (block.level > prev)
//         prev = block.level;
//     }
//   }
 
//   Logger.debug(`findVisibleLevelState: current=${current}, higher=${prev}, lower=${next}`);
//   return { current, prev: prev, next: next };
// }

/////////////////////////////////////////////////////

// 对 blocks 进行汇总，得出每个 level 的 folded 状态 (每个level的 block里有一个 folded 则 该 level 就是 folded)
// 返回值是一个 Record<number, boolean>，key是level，value是该level是否folded, 不存在的level不会出现在结果里(访问时是undefined)
function summarizeLevels(blocks: FoldableBlockInfo[]): Record<number, boolean> {
  return blocks.reduce((acc, b) => {
    acc[b.level] ||= b.folded;
    return acc
  }, {} as Record<number, boolean>);
}

export const setExactVisibleLevel = (level: number) => (view: EditorView) => {
  if (level < -1 || level > 7) return false
  const blocks = getFoldableBlocks(view)
  setVisibleLevel(view, blocks, level)
  return true
}

export const increaseVisibleLevel: Command = (view: EditorView) => {
  const blocks = getFoldableBlocks(view);
  const levels = summarizeLevels(blocks);

  //Logger.debug(`summarized levels: ${JSON.stringify(levels)}`);

  // 从小往大 找出第一个 folded 的 level
  let level = 7;
  for (let i = 0; i <= 7; i++) {
    if (levels[i] === true) { // 该level有folded的block      
      level = i;
      break;
    }
  }
  //Logger.debug(`first folded level: ${level}`);

  setVisibleLevel(view, blocks, level);
  return true;
}

export const decreaseVisibleLevel: Command = (view: EditorView) => {
  const blocks = getFoldableBlocks(view);
  const levels = summarizeLevels(blocks);

  //Logger.debug(`summarized levels: ${JSON.stringify(levels)}`);

  // 从小往大 找出第一个 folded 的 level
  let level = 8;
  for (let i = 0; i <= 7; i++) {
    if (levels[i] === true) { // 该level有folded的block      
      level = i;
      break;
    }
  }
  //Logger.debug(`first folded level: ${level}`);

  // 找出当前实际的 Visible Level
  let visibleLevel = level - 1; // -1~7
  while(visibleLevel >= 0 && levels[visibleLevel] === undefined) visibleLevel--; // 跳过不存在的level

  // 找出下一个有效的 Visible Level
  let nextVisibleLevel = visibleLevel - 1;
  while(nextVisibleLevel >= 0 && levels[nextVisibleLevel] === undefined) nextVisibleLevel--; // 跳过不存在的level

  setVisibleLevel(view, blocks, nextVisibleLevel);
  return true;
}
