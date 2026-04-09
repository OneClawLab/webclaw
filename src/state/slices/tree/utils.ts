// TreeUtils.ts
// 针对 TreeNode 结构的通用工具函数集合

import { Assert, Logger } from "@lib/logast.js";
import type { TreeNode } from "./types.js";
import { path } from "@lib/path.js";
import { t } from "@lib/i18n.js";

export const TreeUtils = {

  // 从文件系统 加载 parent（路径为path）的子节点，递归或不递归
  async loadChildren(path: string, parent: TreeNode | null, recursive: boolean): Promise<TreeNode[]> {
    let children = await window.fs.listDir(path);

    const filter = (item) => { return !item.name.startsWith('.') };
    children = filter ? children.filter(filter) : children;

    const nodes: TreeNode[] = [];
    for (const item of children) {
      const node: TreeNode = { // TreeNode的id 定义为 相对于Library根路径的 相对路径，根节点的id为''
        parentId: parent ? parent.id : '',
        id: parent ? (parent.id + '/' + item.name) : item.name,
        name: item.name, 
        isFolder: item.isDirectory, 
        unsaved: false,
      }

      if (item.isDirectory && recursive) {
        node.children = await TreeUtils.loadChildren(item.path, node, recursive);
        node.isExpanded = false;
      }

      nodes.push(node);
    }

    // 文件夹优先排序
    nodes.sort((a, b) => {
      if (a.isFolder === b.isFolder)
        return a.name.localeCompare(b.name);
      return a.isFolder ? -1 : 1;
    });

    return nodes;
  },

  // 深度优先遍历树, 返回一个可迭代对象
  walk(nodes: TreeNode[]): Iterable<TreeNode> {
    function* traverse(nodes: TreeNode[]): Iterable<TreeNode> {
      for (const node of nodes) {
        yield node;
        if (node.children && node.children.length > 0) {
          yield* traverse(node.children);
        }
      }
    }
    return traverse(nodes);
  },

  // 深度优先遍历（DFS）
  // 回调返回 true 时会立刻停止遍历
  // visitor 的参数支持 parent 和 level，方便在遍历时使用
  // 第一层节点(nodes数组内的节点)的 level 为 0，parent 为 null
  // 返回 true 表示遍历被中途停止，false 表示完整遍历结束
  walkTreeDFS(
    nodes: readonly TreeNode[], 
    visitor: (node: TreeNode, parent: TreeNode | null, level: number) => boolean | void,
    parent: TreeNode | null = null,
    level: number = 0
  ): boolean {
    for (const node of nodes) {
      if (visitor(node, parent, level)) return true; // stop immediately
      if (node.children && node.children.length > 0) {
        if (TreeUtils.walkTreeDFS(node.children, visitor, node, level + 1)) return true;
      }
    }
    return false;
  },

  // 广度优先遍历（BFS）
  // 回调返回 true 时会立刻停止遍历
  // 返回 true 表示遍历被中途停止，false 表示完整遍历结束
  walkTreeBFS(nodes: readonly TreeNode[], visitor: (node: TreeNode) => boolean | void): boolean {
    const queue: TreeNode[] = [...nodes];
    while (queue.length > 0) {
      const node = queue.shift()!;
      if (visitor(node)) return true;
      if (node.children && node.children.length > 0)
        queue.push(...node.children);
    }
    return false;
  },

  // immutable 地过滤树，返回新的树结构
  // 谓词返回true的会留下
  filter(nodes: TreeNode[], predicate: (node: TreeNode) => boolean): TreeNode[] {
    function filterRecursive(nodes: TreeNode[]): TreeNode[] {
      const result: TreeNode[] = [];

      for (const node of nodes) {
        const children = node.children ? filterRecursive(node.children) : [];
        if (predicate(node) || children.length > 0)
          result.push({ ...node, children: node.isFolder ? children : undefined });
      }

      return result;
    }

    return filterRecursive(nodes);
  },

  // 排除满足条件的节点，如果父节点被排除，所有子节点都会被排除。最后返回一颗新树。
  exclude(nodes: TreeNode[], predicate: (node: TreeNode) => boolean): TreeNode[] {
    return TreeUtils.filter(nodes, node => !predicate(node));
  },

  // 对树进行映射，返回新的树
  map(nodes: TreeNode[], mapper: (node: TreeNode) => TreeNode): TreeNode[] {
    function mapRecursive(nodes: TreeNode[]): TreeNode[] {
      return nodes.map(node => {
        const mapped = mapper(node);
        return { ...mapped, children: node.children ? mapRecursive(node.children) : undefined };
      });
    }
    return mapRecursive(nodes);
  },

  // 在树中查找节点（深度优先）
  find(nodes: TreeNode[], predicate: (node: TreeNode) => boolean): TreeNode | null {
    let found: TreeNode | null = null;
    TreeUtils.walkTreeDFS(nodes, (node) => {
      if (predicate(node)) {
        found = node;
        return true; // stop
      }
      return false;
    });
    return found;
  },

  // 根据 id 查找节点
  findById(nodes: TreeNode[], id: string): TreeNode | null {
    return TreeUtils.find(nodes, node => node.id === id);
  },

  // 根据节点ID查找其父节点, 顶层节点的父节点为 null, 节点ID找不到时返回 undefined
  findParent(nodes: TreeNode[], nodeId: string): TreeNode | null | undefined {
    const node = TreeUtils.findById(nodes, nodeId);
    if (!node)
      return undefined;
    if (node.parentId)
      return TreeUtils.findById(nodes, node.parentId);
    else
      return null;
  },

  // 查找指定节点的兄弟节点列表，找不到节点时返回 null, 否则至少会返回空数组
  // 根节点的兄弟节点是其他所有根节点
  findSiblings(nodes: TreeNode[], nodeId: string): TreeNode[] | null {
    const parent = TreeUtils.findParent(nodes, nodeId);
    if (parent === undefined)
      return null;
    if (parent === null) // 根节点的兄弟节点就是其他所有根节点
      return nodes.filter(n => n.id !== nodeId);
    else
      return parent.children!.filter(n => n.id !== nodeId);
  },

  // 找到下一个可见节点的ID
  findNextVisibleAdjacentNodeId(nodes: TreeNode[], nodeIds: string[]): string | null {
    const flattened = TreeUtils.flatten(nodes, true);
    let start: boolean = false;
    for (let i = 0; i < flattened.length; i++) {
      const node = flattened[i];
      // 还没到起点
      if (!start) {
        // 找到了起点
        if (nodeIds.includes(node.id)) start = true;
        continue;
      }

      // 已经到起点，返回下一个节点ID
      if (!nodeIds.includes(node.id))
        return node.id;
    }
    return flattened.length > 0 ? flattened[flattened.length - 1].id : null;
  },

  // 获取从根节点到指定节点的路径数组，找不到节点时返回 null
  getPathToNode(nodes: TreeNode[], nodeId: string): TreeNode[] | null {
    const path: TreeNode[] = [];
    TreeUtils.walkTreeDFS(nodes, (node, parent) => {
      if (nodeId.startsWith(node.id))
        path.push(node);
      if (node.id === nodeId)
        return true; // stop
      return false;
    });
    return path.length > 0 && path[path.length - 1].id === nodeId ? path : null;
  },

  // 获取树中所有节点的平铺数组，按TreeView中的从上往下排列
  // visibleOnly 为true时，仅包含可见节点(被展开的节点)
  flatten(nodes: TreeNode[], visibleOnly: boolean): TreeNode[] {
    const result: TreeNode[] = [];

    function traverse(nodeList: TreeNode[]) {
      for (const node of nodeList) {
        result.push(node);
        if (node.isFolder && node.children) {
          // 继续遍历子节点的前提是：要么节点被展开，或者要求返回所有节点
          if (node.isExpanded || !visibleOnly)
            traverse(node.children);
        }
      }
    }

    traverse(nodes);
    return result;
  },

  // 生成在指定兄弟节点中不冲突的名称。
  // 如 "New Folder", "New Folder (1)", "New Folder (2)" ...
  // 或 "untitled.txt", "untitled (1).txt", "untitled (2).txt" ...
  getUniqueName(siblings: string[], isFolder: boolean, baseName: string): string {
    let suffix = 0; let fileName = baseName;
    while (siblings.some(child => child === fileName)) {
      suffix += 1;
      const extIdx = baseName.lastIndexOf('.');
      // 是文件 并且有 扩展名，则把后缀加到名称部分
      if (extIdx > 0 && !isFolder)
        fileName = `${baseName.slice(0, extIdx)}(${suffix})${baseName.slice(extIdx)}`;
      // 否则，直接加到最后 (目录 或 无扩展名的文件)
      else
        fileName = `${baseName}${suffix > 0 ? ` (${suffix})` : ''}`;
    }
    return fileName;
  },

  // 检查 名称是否可以是合法的 文件/文件夹名称
  // 返回 { error: string, validName: string }
  checkFileName(name: string, isFolder: boolean): { error?: string, validName: string } {
    const invalidChars = /[/\\:*?"<>|]/g; // Windows 不允许的字符
    const trimmedName = name.trim();

    if (trimmedName.length === 0)
      return { error: t('errors.validation.nameCannotBeEmpty'), validName: "" };

    if (invalidChars.test(trimmedName))
      return { error: t('errors.validation.nameContainsInvalidChars'), validName: "" };

    // 禁止使用保留名称（Windows）
    const reservedNames = [
      "CON", "PRN", "AUX", "NUL",
      "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
      "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"
    ];
    const upperName = trimmedName.toUpperCase();
    if (reservedNames.includes(upperName) || reservedNames.some(rn => upperName.startsWith(rn + '.')))
      return { error: t('errors.validation.nameIsReserved', { name: trimmedName }), validName: "" };

    return { validName: trimmedName };
  },

  // immutable 地替换树中的某个节点，返回新的树结构
  // 如果找不到节点，则返回原树
  // 这个方法会用newNode替换原节点(包括children), 不会更新子节点的 ID。
  replaceNode(nodes: TreeNode[], targetId: string, newNode: TreeNode): TreeNode[] {
    let replaced = false;

    function replaceRecursive(nodes: TreeNode[]): TreeNode[] {
      return nodes.map(node => {
        if (node.id === targetId) {
          replaced = true;
          return newNode;
        } else if (node.children) {
          const newChildren = replaceRecursive(node.children);
          if (newChildren !== node.children)
            return { ...node, children: newChildren };
        }
        return node;
      });
    }

    const newTree = replaceRecursive(nodes);
    return replaced ? newTree : nodes;
  },

  // immutable 地更新节点ID及其子节点ID(和name），返回新的树结构
  updateNodeId(nodes: TreeNode[], oldId: string, newId: string): TreeNode[] {
    const updateRecursive = (node: TreeNode): TreeNode => {
      const isRenamedNode = node.id === oldId;
      const isParentOfRenamedNode = !isRenamedNode && oldId.startsWith(node.id);
      const isDescendantOfRenamedNode = !isRenamedNode && node.id.startsWith(oldId);

      // 如果当前节点需要更新 ID
      if (isRenamedNode || isDescendantOfRenamedNode) {
        const relativePath = node.id.slice(oldId.length);
        const updatedId = newId + relativePath;
        const newName = isRenamedNode ? path.basename(updatedId) : node.name; // 只有被重命名的节点更新名称

        // 如果是文件夹且有子节点，则递归更新子节点ID/Name
        const newChildren = node.children?.map(updateRecursive);
        if (node.children && newChildren) {
          Assert.isTrue(newChildren !== node.children, "Children should be updated when updating folder ID");
        }

        return { ...node, id: updatedId, name: newName, children: newChildren };
      }

      // 如果当前节点是被重命名节点的父节点，递归更新子节点
      if (isParentOfRenamedNode && node.children) {
        const newChildren = node.children.map(updateRecursive);
        Assert.isTrue(newChildren !== node.children, "Children should be updated when updating parent of renamed node");
        return { ...node, children: newChildren };
      }

      // 其它节点保持不变
      return node;
    };

    return nodes.map(updateRecursive);
  },

  // immutable 地插入新子节点，返回新的树结构，不修改原树 且 尽量复用未修改的节点对象
  // 如果 parentId 为空字符串，则插入到根节点列表
  insertChild(nodes: TreeNode[], parentId: string, newNode: TreeNode): TreeNode[] {
    // 如果 parentId 为空字符串，说明插入到根节点列表，直接返回新的根节点数组
    if (parentId === '')
      return [...nodes, newNode];
    // 遍历当前层的所有节点，递归查找 parentId
    else
      return nodes.map(node => {
        // 如果当前节点就是目标父节点
        if (node.id === parentId)
          // 返回一个新的节点对象，children 数组加入新节点，isExpanded 设为 true
          return { ...node, isExpanded: true, children: [...(node.children ?? []), newNode]};
        // 如果当前节点有子节点，则递归对子节点进行插入操作
        else if (node.children)
          return { ...node, children: TreeUtils.insertChild(node.children, parentId, newNode)};
        // 其它节点保持不变，直接返回原节点对象
        else 
          return node;
      });
  },

  // immutable 地合并两颗树，返回新的树结构，尽量复用未修改的节点对象
  // oldNodes: 旧树节点数组
  // newNodes: 新树节点数组
  // 合并规则:
  // 1. 如果新节点在旧树中不存在，则作为新节点加入结果树
  // 2. 如果新节点在旧树中存在，则比较其属性（除 children 外），如果有变化则创建新节点，否则复用旧节点
  // 3. 对于存在于两棵树中的节点，递归合并其子节点
  // 4. 如果children中的节点没增加/属性没变，只是顺序发生变化，也认为该节点发生了变化。
  merge(oldNodes: TreeNode[], newNodes: TreeNode[]): TreeNode[] {
    // 快路径
    if (oldNodes.length === 0 && newNodes.length === 0) return oldNodes; 
    if (oldNodes.length === 0) return newNodes.map(n => ({ ...n }));
    if (newNodes.length === 0) return [];

    // 若顶层 id 序列不一致（包括顺序或内容变化），标记 changed（即便节点对象可能被复用）
    const oldIdSeq = oldNodes.map(n => n.id).join(',');
    const newIdSeq = newNodes.map(n => n.id).join(',');
    let changed = oldIdSeq !== newIdSeq; 
    
    // 建立旧节点的映射，方便快速查找
    const oldMap = new Map<string, TreeNode>();
    for (const node of oldNodes)
      oldMap.set(node.id, node);
    // 记录已经使用过的旧节点ID，检测删除
    const usedOldIds = new Set<string>();

    const merged: TreeNode[] = [];

    for (const newNode of newNodes) {
      // 先看看新节点在旧树中是否存在
      const oldNode = oldMap.get(newNode.id);

      // 新节点在旧树中不存在，直接加入
      if (!oldNode) {
        changed = true;
        merged.push({ ...newNode });
        continue;
      }

      // 存在：记录已用旧节点 id（用于检测删除）
      usedOldIds.add(oldNode.id);

      // 旧节点存在，那么检查有无变化

      // 首先：检查除 children 外的 基本属性 是否相同
      const keys = Object.keys(newNode).filter(k => k !== 'children');
      const basicPropChanged = keys.some(key => newNode[key] !== oldNode[key]);

      // 其次：检查 children 是否有变化
      const oldChildren = oldNode.children || [];
      const newChildren = newNode.children || [];

      // children 的数量和顺序变化都算作 本节点有变化 (但子节点变没变并不知道)
      const childrenListChanged =
        oldChildren.length !== newChildren.length ||
        !newChildren.every((child, idx) => oldChildren[idx]?.id === child.id);

      // 递归合并子节点, 有变化则返回新数组, 无变化则返回旧数组
      const mergedChildren = TreeUtils.merge(oldChildren, newChildren);

      // 如果基本属性有变化，或者 children 数量/顺序有变化，或者 children 自身有变化，都需要重建此节点
      if (basicPropChanged || childrenListChanged || mergedChildren !== oldChildren) {
        changed = true;
        merged.push({ ...newNode, children: mergedChildren });
      } else  // 什么都没变化，复用旧节点
        merged.push(oldNode);
    }

    // 若存在旧节点未被 newNodes 使用，说明有删除
    if (oldNodes.length > 0) {
      for (const o of oldNodes) {
        if (!usedOldIds.has(o.id)) {
          changed = true;
          break;
        }
      }
    }

    return changed ? merged : oldNodes;
  },

  // immutable 地复用旧节点，合并新节点列表，但要保持旧的展开状态，返回新的树结构
  reuseMerge(oldNodes: TreeNode[], newNodes: TreeNode[]): TreeNode[] {
    // 把节点展开状态 从oldNodes 拷贝 到 newNodes
    TreeUtils.walkTreeDFS(oldNodes, (oldNode) => {
      if (oldNode.isFolder && oldNode.isExpanded) {
        const newNode = TreeUtils.findById(newNodes, oldNode.id);
        if (newNode && newNode.isFolder)
          newNode.isExpanded = true;
      }
      return false; // just to traverse all nodes
    });

    // 合并节点列表，尽量重用旧节点
    const mergedNodes = TreeUtils.merge(oldNodes, newNodes)
    return mergedNodes;
  },

};
