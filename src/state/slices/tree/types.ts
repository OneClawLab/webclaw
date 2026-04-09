
// 一棵树的Header信息（对应于一个知识库）
export type TreeHeader = {
  id: string;               // 唯一ID，就是Library的ID
  name: string;             // Display name，一般就是知识库的显示名称
  expanded: boolean;        // 整棵树在视图中是否展开
};

// 一个树节点
export type TreeNode = {
  id: string;               // 唯一ID，是相对于Library根路径的相对路径
  name: string;             // Display name
  isFolder: boolean;        // 是否是目录

  parentId: string;         // 父目录的唯一ID，顶层节点的 parentId 为 ''
  unsaved: boolean;         // 是否刚被创建，尚未保存到文件系统

  // 当 isFolder 为 true 时
  children?: TreeNode[];    // 仅对目录有效，无子节点时为空数组。
  isExpanded?: boolean;     // 仅对目录有效：是否视图中展开了子节点。
  
  // 当 isFolder 为 false 时
  isOpen?: boolean;         // 仅对文件有效：是否在编辑器中被打开了
  isModified?: boolean;     // 仅对文件有效：是否文件被修改了
};

// 单个 Tree 的状态结构
export interface TreeState {
  header: TreeHeader;       // 树的Header信息
  nodes: TreeNode[];        // 树的顶层节点列表
  filter: string;           // 暂时未用：过滤字符串，name 包含此字符串的节点会被显示

  focusedNodeId?: string;     // 当前焦点节点ID
  selectedNodeIds: string[];  // 当前选中的节点ID列表
  _editState?: TreeEditState; // 当某节点正在被编辑(名称)时有效(下划线开头表示不持久化该字段)
}

// 树的节点编辑状态
// 新建的逻辑：
//   新建时会自动插入一个节点到指定位置，unsaved 为 true，然后 editState 进入 create 模式。
//   用户编辑名称并提交后，真正创建文件/目录，更新节点的 id/name/unsaved 状态，editState 清空。
//   如果用户取消编辑，则删除该节点，editState 清空。
// 重命名的逻辑：
//   重命名时，editState 进入 rename 模式。
//   用户编辑名称并提交后，更新节点的 id/name，更新文件系统，editState 清空。
//   如果用户取消编辑，则不做任何修改，editState 清空。
export type TreeEditState = {
  mode: 'rename' | 'create' // 正在重命名已有节点，还是正在创建新节点
  parentId: string          // 该节点的父节点ID
  isFolder: boolean         // 该节点是否是文件夹

  editingId?: string        // 正在被编辑名称的节点的ID，用于在TreeView中定位
  editingName: string       // 当前被编辑的节点名称
  error?: string            // 编辑名称过程中的实时校验错误信息
}

// treeSlice 的 state 结构
export interface TreeStates {
  trees: TreeState[];       // 多个 Tree 的状态集合
  activeTreeId?: string;    // 当前活动的(有焦点的) Tree ID
}

export const initialState: TreeStates = {
  trees: [],
};
