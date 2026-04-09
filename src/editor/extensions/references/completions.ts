import type { Completion } from '@codemirror/autocomplete';
import { getState } from '@state/storeHolder.js';
import type { TreeState } from '@state/slices/tree/types.js';
import { TreeUtils } from '@state/slices/tree/utils.js';

function rootCompletions(prefix: string): {
  options: Completion[];
  isComplete: boolean; // 当前最后一级已经完整，不需要再补全
} | null {
  const options: Completion[] = [
    { label: '@kb/', apply: '@kb/', displayLabel: 'kb', detail: '知识库' },
    { label: '@this', apply: '@this', displayLabel: 'this', detail: '当前文档' },
    { label: '@history', apply: '@history', displayLabel: 'history', detail: '历史聊天记录' },
  ];

  return {
    options: options.filter((opt) => opt.displayLabel!.startsWith(prefix)),
    isComplete: options.some((opt) => opt.displayLabel === prefix && !opt.label.endsWith('/')),
  };
}

function kbCompletions(segments: string[], prefix: string): {
  options: Completion[];
  isComplete: boolean;
} | null {
  if (segments[0] !== 'kb') throw new Error('kbCompletions: segments 应以 kb 开头');

  // @kb/...
  if (segments.length === 1) {
    const trees: TreeState[] = getState().tree.trees;
    const kbs = trees.map((t) => ({ name: t.header.name }));
    if (kbs.length === 0) return null;

    const options = kbs
      .filter((kb) => kb.name.startsWith(prefix))
      .map((kb) => ({
        label: kb.name + '/',
        displayLabel: kb.name,
        detail: '知识库',
        apply: kb.name + '/',
        type: 'folder',
      }));

    return {
      options,
      isComplete: options.some((opt) => opt.displayLabel === prefix && !opt.label.endsWith('/'))
    };
  }

  // @kb/<库名>/...
  const kb = segments[1];
  const trees: TreeState[] = getState().tree.trees;
  const tree = trees.find((t) => t.header.name === kb);
  if (!tree || !tree.nodes) return null;

  const pathSegments = segments.slice(2); // 去掉 kb 和 库名
  // 如果有子路径，取得该文件夹的子节点，否则取第一层节点
  let nodes = tree.nodes;
  if (pathSegments.length > 0) {
    const parentId = `${pathSegments.join('/')}`;
    const parentNode = TreeUtils.findById(tree.nodes, parentId);
    if (!parentNode || !parentNode.isFolder || !parentNode.children) return null;
    nodes = parentNode.children;
  }

  const options: Completion[] = nodes
    .filter((child) => child.name.startsWith(prefix))
    .map((child) => ({
      label: child.isFolder ? child.name + '/' : child.name,
      displayLabel: child.name,
      detail: child.isFolder ? '文件夹' : '文件',
      apply: child.isFolder ? child.name + '/' : child.name,
      type: child.isFolder ? 'folder' : 'file',
    }));
  return {
    options,
    isComplete: options.some((opt) => opt.displayLabel === prefix && !opt.label.endsWith('/')),
  };
}

// 根据 已经输入完整的 segments 返回当前最后一段的补全列表
// 可以同时进一步 根据 prefix 进行过滤
// segments: 已经输入完整的 segments 列表
// 只有一个 segment 的最后有了/，才认为此 segment 是完整的
// prefix: 当前正在输入的 segment 的前缀
// 返回 isComplete 表示当前最后一级已经完整且没有子项了，不需要再补全。
export function getCompletions(segments: string[], prefix: string): {
  options: Completion[];
  isComplete: boolean;
} | null {
  // 根补全
  if (segments.length === 0)
    return rootCompletions(prefix);

  // kb 补全
  if (segments[0] === 'kb')
    return kbCompletions(segments, prefix);

  return null;
}
