import { Logger } from '@lib/logast.js'
import type { PayloadAction } from '@reduxjs/toolkit'
import { Draft } from 'immer'

import { Tab, TabState, TabStatus, ViewState } from './types.js';
import { theFocusManager } from '@view/index.js';
import { TabUtils } from './utils.js';
import { DocUtils } from '../doc/utils.js';

const openTab = (state: Draft<TabState>, action: PayloadAction<{ tab: Partial<Tab>, switchTo: boolean, switchFocus: boolean }>) => {
  const tab =  TabUtils.createTab(action.payload.tab);
  state.tabs.push(tab);

  if (action.payload.switchTo) {
    state.activeTabId = tab.id;          // 切换到新打开的 Tab 
    state.recentTabIds.unshift(tab.id);  // 最新使用的放在最前面
  } else 
    state.recentTabIds.push(tab.id);     // 没有切换过去的放在最后面

  if (action.payload.switchFocus)
    theFocusManager.setFocus('EditorView', tab.id);

  Logger.debug('tabSlice', `Opening tab: ${tab.viewType} => ${tab.id}`);
};

// 关闭指定 Tab, 并切换到下一个 Tab（如果有的话）
// ignorePinned: boolean 是否忽略 pinned 状态强制关闭 Tab，默认为 false
// 这个不会管文档是否有未保存的更改，调用者需要自己处理
const closeTab = (state: Draft<TabState>, action: PayloadAction<{ tabId: string, ignorePinned?: boolean }>) => {
  Logger.debug('tabSlice', `Closing tab: ${action.payload.tabId}`);

  const index = state.tabs.findIndex(t => t.id === action.payload.tabId)
  if (index === -1) {
    Logger.warn('tabSlice', `Tab not found: ${action.payload.tabId}`);
    return
  }

  // 检查是否 pinned, 如果是且不忽略则不关闭
  const ignorePinned = action.payload.ignorePinned ?? false;
  if (!ignorePinned && state.tabs[index].pinned) {
    Logger.debug('tabSlice', `Tab is pinned, cannot close: ${action.payload.tabId}`);
    return;
  }

  // 从打开的 Tab 列表中移除
  state.tabs.splice(index, 1)

  // 从最近使用的列表中移除
  const indexInRecentList = state.recentTabIds.indexOf(action.payload.tabId);
  if (indexInRecentList !== -1)
    state.recentTabIds.splice(indexInRecentList, 1);

  // 如果关闭的 tab 是当前激活的 tab，则切换到下一个 tab
  if (state.activeTabId === action.payload.tabId) {
    state.activeTabId = undefined

    let nextActiveTabId;
    // 注: EditorView的ID就是TabId。此处传进excludes是为了避免返回一个正在被关闭的tab
    const tabId = theFocusManager.getLastFocusedViewId('EditorView', [action.payload.tabId]);
    if (tabId && state.tabs.find(t => t.id === tabId)) {
      nextActiveTabId = tabId;
      Logger.debug('tabSlice', `Switching to last focused tab: ${nextActiveTabId}`);
    } else {
      nextActiveTabId = state.tabs[index] ? state.tabs[index].id : state.tabs[index - 1]?.id ?? null;
      Logger.debug('tabSlice', `Switching to next tab by position: ${nextActiveTabId}`);
    }

    if (nextActiveTabId)
      setActiveTab(state, nextActiveTabId, true);
    else { // 没有可切换的 tab 了，尝试切换焦点到 Active 的 TreeView
      const viewId = theFocusManager.getLastFocusedViewId('TreeView');
      if (viewId)
        theFocusManager.setFocus('TreeView', viewId);
    }
  }
}

function setActiveTab(state: Draft<TabState>, tabId: string, switchFocus: boolean) {
  const index = state.recentTabIds.indexOf(tabId);
  if (index >= 0) {
    state.activeTabId = tabId;
    state.recentTabIds.splice(index, 1);
    state.recentTabIds.unshift(tabId);
  }

  // 按要求切换焦点到对应的 EditorView
  if (switchFocus)
    theFocusManager.setFocus('EditorView', tabId);
}

const switchTab = (state: Draft<TabState>, action: PayloadAction<{ tabId: string, switchFocus: boolean }>) => {
  setActiveTab(state, action.payload.tabId, action.payload.switchFocus);
}

const renameTab = (state: Draft<TabState>, action: PayloadAction<{ tabId: string; title: string }>) => {
  Logger.debug('tabSlice', `Renaming tab: ${action.payload.tabId} to ${action.payload.title}`);
  const tab = state.tabs.find(t => t.id === action.payload.tabId)
  if (!tab) {
    Logger.warn('tabSlice', `Tab not found for renaming: ${action.payload.tabId}`);
    return
  }
  tab.title = action.payload.title
}

// 更新 Tab 的 meta 信息，合并已有的 meta，不会删除没有在 payload 中的字段
const updateTabMeta = (state: Draft<TabState>, action: PayloadAction<{ tabId: string; meta: Record<string, any> }>) => {
  const tab = state.tabs.find(t => t.id === action.payload.tabId)
  if (!tab) {
    Logger.warn('tabSlice', `Tab not found for meta update: ${action.payload.tabId}`);
    return
  }
  tab.meta = { ...tab.meta, ...action.payload.meta };
}

const updateTabViewState = (state: Draft<TabState>, action: PayloadAction<{ tabId: string, viewState: ViewState }>) => {
  const tab = state.tabs.find(t => t.id === action.payload.tabId)
  if (!tab) {
    Logger.warn('tabSlice', `Tab not found for viewState update: ${action.payload.tabId}`);
    return
  }

  tab.viewState = action.payload.viewState;
}

const updateTabStatus = (state: Draft<TabState>, action: PayloadAction<{ tabId: string; status: TabStatus }>) => {
  const tab = state.tabs.find(t => t.id === action.payload.tabId)
  if (!tab) {
    Logger.warn('tabSlice', `Tab not found for status update: ${action.payload.tabId}`);
    return
  }
  if (tab.status === action.payload.status)
    return

  Logger.debug('tabSlice', `Updating tab status: ${action.payload.tabId} to ${action.payload.status}`);
  tab.status = action.payload.status;
}

const markTabHighlight = (state: Draft<TabState>, action: PayloadAction<{ tabId: string; highlight: boolean }>) => {
  const tab = state.tabs.find(t => t.id === action.payload.tabId)
  if (!tab) {
    Logger.warn('tabSlice', `Tab not found for highlight mark: ${action.payload.tabId}`);
    return
  }
  if (tab._highlight === action.payload.highlight)
    return

  Logger.debug('tabSlice', `Marking tab highlight: ${action.payload.tabId} to ${action.payload.highlight}`);
  tab._highlight = action.payload.highlight;
}

const markTabEditing = (state: Draft<TabState>, action: PayloadAction<{ tabId: string; editing: boolean }>) => {
  const tab = state.tabs.find(t => t.id === action.payload.tabId)
  if (!tab) {
    Logger.warn('tabSlice', `Tab not found for editing mark: ${action.payload.tabId}`);
    return
  }
  if (tab._editing === action.payload.editing)
    return

  Logger.debug('tabSlice', `Marking tab editing: ${action.payload.tabId} to ${action.payload.editing}`);
  tab._editing = action.payload.editing;
}

const markTabDirty = (state: Draft<TabState>, action: PayloadAction<{ tabId: string; dirty: boolean }>) => {
  const tab = state.tabs.find(t => t.id === action.payload.tabId)
  if (!tab) {
    Logger.warn('tabSlice', `Tab not found for dirty mark: ${action.payload.tabId}`);
    return
  }

  if (tab.ignoreDirty || tab._dirty === action.payload.dirty)
    return

  Logger.debug('tabSlice', `Marking tab dirty: ${action.payload.tabId} to ${action.payload.dirty}`);
  tab._dirty = action.payload.dirty;
}

// 为指定 docId 的所有 Tab 标记 dirty 状态
const markTabsDirtyForDoc = (state: Draft<TabState>, action: PayloadAction<{ docId: string; dirty: boolean }>) => {
  const tabs = state.tabs.filter(t => t.docId === action.payload.docId)
  if (tabs.length === 0) {
    Logger.warn('tabSlice', `No tabs found for dirty mark by docId: ${action.payload.docId}`);
    return
  }

  for (const tab of tabs) {
    if (tab.ignoreDirty || tab._dirty === action.payload.dirty)
      return
    Logger.debug('tabSlice', `Marking tab dirty: ${tab.id} to ${action.payload.dirty}`);
    tab._dirty = action.payload.dirty;
  }
}

// 为指定 docId 的所有 Tab 标记 hasChatMemory 状态
const markTabsHasChatMemoryForDoc = (state: Draft<TabState>, action: PayloadAction<{ docId: string; hasChatMemory: boolean }>) => {
  const tabs = state.tabs.filter(t => t.docId === action.payload.docId)
  if (tabs.length === 0) {
    Logger.warn('tabSlice', `No tabs found for hasChatMemory mark by docId: ${action.payload.docId}`);
    return
  }

  for (const tab of tabs) {
    if (tab.hasChatMemory === action.payload.hasChatMemory)
      return
    Logger.debug('tabSlice', `Marking tab hasChatMemory: ${tab.id} to ${action.payload.hasChatMemory}`);
    tab.hasChatMemory = action.payload.hasChatMemory;
  }
}

// 当某个 docId 变更(但文档没变)时，更新所有相关 Tab 的 docId
const updateTabsDocId = (state: Draft<TabState>, action: PayloadAction<{ oldDocId: string; newDocId: string }>) => {
  const { oldDocId, newDocId } = action.payload;
  const tabs = state.tabs.filter(t => t.docId === oldDocId)
  if (tabs.length === 0) {
    Logger.warn('tabSlice', `No tabs found for docId update: ${oldDocId}`);
    return
  }

  for (const tab of tabs) {
    Logger.debug('tabSlice', `Updating tab docId: ${tab.id} from ${oldDocId} to ${newDocId}`);
    tab.docId =  newDocId;
    tab.title = DocUtils.extractDocTitleFromId(newDocId);
    // TODO 如何 让 Tab 不要刷新，因为 docId 变了可能会导致 Tab 重新加载内容
  }
}

const refreshTab = (state: Draft<TabState>, action: PayloadAction<{ tabId: string }>) => {
  const tab = state.tabs.find(t => t.id === action.payload.tabId)
  if (!tab) {
    Logger.warn('tabSlice', `Tab not found for refresh: ${action.payload.tabId}`);
    return
  }

  // 具体Refresh逻辑由 Editor 做，这里只是发一个变化信号
  tab._refresh = tab._refresh ? tab._refresh + 1 : 1;
  Logger.debug('tabSlice', `Refreshing tab: ${action.payload.tabId}, new refresh=${tab._refresh}`);
}

const setTabAutoScroll = (state: Draft<TabState>, action: PayloadAction<{ tabId: string; autoScroll: boolean }>) => {
  const tab = state.tabs.find(t => t.id === action.payload.tabId)
  if (!tab) {
    Logger.warn('tabSlice', `Tab not found for set autoScroll: ${action.payload.tabId}`);
    return
  }
  if (tab._autoScroll === action.payload.autoScroll)
    return

  Logger.debug('tabSlice', `Setting tab ${action.payload.tabId} autoScroll to ${action.payload.autoScroll}`);
  tab._autoScroll = action.payload.autoScroll;
}

const reorderTab = (state: Draft<TabState>, action: PayloadAction<{ fromIndex: number; toIndex: number }>) => {
  Logger.debug('tabSlice', `Reordering tabs: from ${action.payload.fromIndex} to ${action.payload.toIndex}`);
  const [moved] = state.tabs.splice(action.payload.fromIndex, 1)
  state.tabs.splice(action.payload.toIndex, 0, moved)
}

const moveTab = (state: Draft<TabState>, action: PayloadAction<{ tabId: string; toIndex: number }>) => {
  Logger.debug('tabSlice', `Moving tab: ${action.payload.tabId} to index: ${action.payload.toIndex}`);

  const currentIndex = state.tabs.findIndex(t => t.id === action.payload.tabId);
  if (currentIndex === -1) {
    Logger.warn('tabSlice', `Tab not found for moving: ${action.payload.tabId}`);
    return;
  }

  if (currentIndex === action.payload.toIndex) {
    Logger.debug('tabSlice', `Tab ${action.payload.tabId} is already at index ${action.payload.toIndex}`);
    return;
  }

  // Remove the tab from its current position
  const [movedTab] = state.tabs.splice(currentIndex, 1);

  // Insert the tab at the new position
  state.tabs.splice(action.payload.toIndex, 0, movedTab);

  // Determine if the tab's pinned status needs to change
  const isPinned = movedTab.pinned;
  const beforeTab = state.tabs[action.payload.toIndex - 1];   // 新位置前的 Tab
  const afterTab = state.tabs[action.payload.toIndex + 1];    // 新位置后的 Tab

  // 新位置之后的 Tab 是 pinned 的话，当前 Tab 必须是 pinned
  if (afterTab && afterTab.pinned) {
    // All tabs before a pinned tab must be pinned
    if (!isPinned) {
      movedTab.pinned = true;
      Logger.debug('tabSlice', `Tab ${action.payload.tabId} automatically pinned due to position change.`);
    }
  }

  // 新位置之前的 Tab 是 unpinned 的话，当前 Tab 必须是 unpinned
  if (beforeTab && !beforeTab.pinned) {
    // All tabs after an unpinned tab must be unpinned
    if (isPinned) {
      movedTab.pinned = false;
      Logger.debug('tabSlice', `Tab ${action.payload.tabId} automatically unpinned due to position change.`);
    }
  }

  Logger.debug('tabSlice', `Tab ${action.payload.tabId} moved successfully to index ${action.payload.toIndex}`);
};

// 关闭除指定 Tab 外的所有 Tab
// 是否关闭 pinned 的 看 ignorePinned 参数，默认为 false
const closeTabs = (state: Draft<TabState>, action: PayloadAction<{ excludedTabIds?: string[], ignorePinned?: boolean }>) => {
  const { excludedTabIds, ignorePinned } = action.payload;
  Logger.debug('tabSlice', `Closing all other tabs except: ${action.payload.excludedTabIds?.join(', ') || []}`);

  state.tabs = state.tabs.filter(t => action.payload.excludedTabIds?.includes(t.id) || (ignorePinned && t.pinned));
  state.activeTabId = state.tabs.find(t => t.id === state.activeTabId)?.id || excludedTabIds?.[0] || undefined;
  state.recentTabIds = state.tabs.map(t => t.id);
};

const pinTab = (state: Draft<TabState>, action: PayloadAction<{ tabId: string; pinned: boolean }>) => {
  const tab = state.tabs.find(t => t.id === action.payload.tabId);
  if (!tab) {
    Logger.warn('tabSlice', `Tab not found for pinning: ${action.payload.tabId}`);
    return;
  }
  if (tab.pinned === action.payload.pinned) {
    Logger.debug('tabSlice', `Tab ${action.payload.tabId} already pinned=${action.payload.pinned}`);
    return;
  }

  Logger.debug('tabSlice', `Setting tab ${action.payload.tabId} pinned=${action.payload.pinned}`);
  tab.pinned = action.payload.pinned;

  // 把 改变了 pin 状态的Tab 移动到所有 unpinned 之前的位置
  state.tabs = [
    ...state.tabs.filter(t => t.pinned),
    ...state.tabs.filter(t => !t.pinned),
  ];
};

const switchToNextUnpinnedTab = (state: Draft<TabState>, action: PayloadAction<{ currentTabId?: string }>) => {
  let currentTabId: string | undefined = action.payload.currentTabId;
  if (!currentTabId)
    currentTabId = state.activeTabId;

  const unpinnedTabs = state.tabs.filter(t => !t.pinned && t.id !== currentTabId);
  if (unpinnedTabs.length === 0) {
    Logger.debug('tabSlice', `No unpinned tabs available to switch to.`);
    return;
  }

  // 找到当前 Tab 在所有 Tab 中的位置，选择下一个未 pinned 的 Tab 切换过去
  const currentIndex = state.tabs.findIndex(t => t.id === currentTabId);
  let nextTab = unpinnedTabs.find(t => state.tabs.indexOf(t) > currentIndex);
  if (!nextTab) // 没有找到更后面的，选择第一个未 pinned 的 Tab
    nextTab = unpinnedTabs[0];

  Logger.debug('tabSlice', `Switching to next unpinned tab: ${nextTab.id}`);
  setActiveTab(state, nextTab.id, true);
}

export function buildReducers() {
  return {
    openTab,
    closeTab,
    switchTab,
    renameTab,
    markTabHighlight,
    markTabEditing,
    markTabDirty,
    markTabsDirtyForDoc,
    markTabsHasChatMemoryForDoc,
    setTabAutoScroll,
    updateTabsDocId,
    refreshTab,
    updateTabMeta,
    updateTabStatus,
    updateTabViewState,
    reorderTab,
    moveTab,
    closeTabs,
    pinTab,
    switchToNextUnpinnedTab,
  }
}
