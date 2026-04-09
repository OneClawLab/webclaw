import { RootState } from "@state/types.js"

export const selectActiveLib = (state: RootState) => {
  const activeTreeId = state.tree.activeTreeId;
  const activeLibId = activeTreeId; // treeId 就是 libId
  if (!activeLibId) return null;
  return state.lib.libs[activeLibId];
}

export const selectActiveTree = (state: RootState) => {
  const activeTreeId = state.tree.activeTreeId;
  if (!activeTreeId) return null;
  return state.tree.trees.find(t => t.header.id === state.tree.activeTreeId);
}

export const selectActiveTab = (state: RootState) => {
  const activeTabId = state.tab.activeTabId;
  if (!activeTabId) return null;
  return state.tab.tabs.find(t => t.id === activeTabId);
}

export const selectTab = (id: string) => (state: RootState) => {
  return state.tab.tabs.find(t => t.id === id)
}

export const selectLib = (id: string) => (state: RootState) => {
  return state.lib.libs[id];
}

export const selectTree = (id: string) => (state: RootState) => {
  return state.tree.trees.find(t => t.header.id === id);
}
