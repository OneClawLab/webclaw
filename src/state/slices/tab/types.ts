import { RuntimeState } from "../runtime/types.js";

// Tab 的状态类型: 正常 / 过时(外部变了) / 已删除(未找到) / 打开错误
export type TabStatus = 'normal' | 'outdated' | 'deleted' | 'error';

// Tab 视图的 内部状态类型，直接使用 RuntimeState
export type ViewState = RuntimeState;

export interface Tab {
  id: string                  // tab 的唯一标识符
  viewType: string            // tab 的视图类型

  docId: string               // Tab对应的文档的唯一ID，见 docId() 函数

  _refresh?: number           // 用于触发 ChatEditor 重新加载内容的信号，每次刷新时递增
  ignoreDirty: boolean        // 为 true 时 忽略 dirty 标志，即 dirty 总是 false

  // dirty设计:
  //   当前设计为，文档需要手动保存，因此 我们不持久化 dirty 状态
  //   如果要设计为 文档需要手动保存，但能自动备份, 则需要持久化 dirty 状态
  //   也可以设计为 自动保存，这样就根本不需要 dirty 状态了
  // 如果今后要改，建议把这个_dirty字段用做 runtime dirty 状态，另加一个 persistent dirty 字段即可。
  _dirty: boolean             // tab 是否有未保存的更改

  status: TabStatus           // tab 的当前状态
  _autoScroll?: boolean       // 是否启用自动滚动

  viewState?: ViewState       // 视图的内部状态

  icon: string                // 图标名称, LucideIcon 名称
  title: string               // tab 的标题

  pinned: boolean             // 是否被置顶(同时也暂时不可关闭)
  closable: boolean           // 是否可以关闭

  _editing?: boolean          // 标记 对应的文档 正在被(AI)自动编辑中
  _highlight?: boolean        // 标记 tab 标题是否高亮

  hasChatMemory: boolean      // 标记 该tab是否包含AI聊天记忆(只要在此Tab和AI聊过天就会有记忆)

  // 可选的扩展元数据字段
  // 目前支持:
  //   agentName: 关联的 agent 的名称
  //   linkTo: { peerViewId: string; peerDocId: string }   // 主动方: 存储被动方Tab的 ViewId(也就是TabId)和DocId
  //   linkedBy: { peerViewId: string; peerDocId: string } // 被动方: 存储主动方Tab的 ViewId(也就是TabId)和DocId
  //   autoCommit: number  // 自动提交的时间间隔，单位秒，0或未设置表示不自动提交
  meta?: Record<string, any>
}

// tabSlice 的 state 结构
export interface TabState {
  tabs: Tab[]                 // 当前打开的 tab 列表，可能为空，这是一个有序列表
  activeTabId?: string        // 当前激活的 tab ID
  recentTabIds: string[]      // 最近使用的 tab 的 ID 列表, 倒叙排列(最近使用的在前面)，可能为空
}

export const initialState: TabState = {
  tabs: [],
  activeTabId: undefined,
  recentTabIds: [],
};
