import { Logger, Assert } from '@lib/logast.js'
import type { RootState } from '@state/types.js'

import { debounce, DebounceStrategyParams } from '@lib/debounce.js'
import { shallowEqual } from 'react-redux';

import { initialState as settingsInitialState } from '@state/slices/settings/types.js';
import { initialState as workspaceInitialState } from '@state/slices/workspace/types.js';
import { initialState as uiInitialState } from '@state/slices/ui/types.js';
import { initialState as libInitialState } from '@state/slices/lib/types.js';
import { initialState as docInitialState } from '@state/slices/doc/types.js';
import { initialState as tabInitialState } from '@state/slices/tab/types.js';
import { initialState as treeInitialState } from '@state/slices/tree/types.js';
import { initialState as dialogInitialState } from '@state/slices/dialog/types.js';
import { initialState as runtimeInitialState } from '@state/slices/runtime/types.js';
import { initialState as userInitialState } from '@state/slices/user/types.js';
import { initialState as connectionInitialState } from '@state/slices/connection/types.js';
import { initialState as agentInitialState } from '@state/slices/agent/types.js';

// 需要Redux管里的持久化的内容:
// 1. per app: 用户账号，主题设置，最后一次打开的 workspace
//    存储在单独一个文件里。
// 2. per workspace: 窗口布局，包含的library列表，TreeView 状态，Tabs/Editor的状态
//    存储在 workspace文件里。
// 3. per editor: 编辑器状态（临时折叠状态、光标位置、滚动位置等）
//    存储在 workspace文件里。
//
// 以下不属于 Redux 管理的持久化内容：
// 1. per library: library的元信息，目录结构，标签信息
// 2. per document: 文档内容，元信息，永久折叠状态

// 持久化字段约定: 凡是_开头的字段，均不持久化(要求用?:定义为可选字段)

export function selectPersistentState(state: RootState) {
  return {
    settings: state.settings,     // app 级别的设置信息
    workspace: state.workspace,   // 包含了 workspace 相关的持久化信息，其他 slice 的状态都属于 当前 workspace
    ui: state.ui,
    user: state.user,             // 用户登录状态和信息
    // lib: state.lib,            // 不直接持久化lib状态，workspace 包含 LibPaths，每次会依此重建 libSlice 的状态
    doc: state.doc,
    tab: state.tab,
    tree: state.tree,
    // dialog: state.dialog,      // 不持久化
    // runtime: state.runtime,    // 不持久化
  };
}

type SelectedStates = ReturnType<typeof selectPersistentState>;

let prevState: SelectedStates | undefined;

export function initPrevPersistentState(state: SelectedStates) {
  prevState = state;
}

// 结合检测变化+保存的函数，保存只针对变更slice
export function savePersistentStateIfChanged(currentState: SelectedStates): boolean {
  if (!prevState) {
    prevState = currentState;
    const namespaces = [currentState.workspace.id];
    // 初始状态，直接保存所有slice
    for (const key in currentState)
      debouncedSaveSliceStates[key](currentState[key], namespaces);
    return true;
  }

  let hasChanged = false;

  // 针对每个slice检测变化，只保存变更的slice的最新状态
  for (const key in currentState) {
    // 注: shallowEqual 只比较第一层属性的引用
    if (!shallowEqual(prevState[key], currentState[key])) {
      // 所有状态都隶属于当前workspace，需要加上命名空间
      const namespaces = [currentState.workspace.id];
      //Logger.debug(`Persistent state slice changed: ${key}, saving...`);
      debouncedSaveSliceStates[key](currentState[key], namespaces);
      hasChanged = true;
    }
  }

  if (hasChanged)
    prevState = currentState;

  return hasChanged;
}

// 重要状态保存策略
const DEBOUNCE_STRATEGY_IMPORTANT: DebounceStrategyParams = [
  1000,               // 1秒延迟
  {
    leading: true,    // 在开始时触发
    trailing: true,   // 在结束时触发
    maxWait: 10000,   // 最多10秒强制触发一次
  },
]

// 不那么重要的状态保存策略
const DEBOUNCE_STRATEGY_FREQUENT: DebounceStrategyParams = [
  3000,               // 3秒延迟
  {
    leading: false,   // 不在开始时触发
    trailing: true,   // 在结束时触发
    maxWait: 30000,   // 最多30秒强制触发一次
  },
]

// 保存单个 slice 状态 的 debounce 函数集合
// 不能用一个，否则会 总是再中间触发得保存永远得不到执行（因为防抖策略往往会丢弃中间的调用）
const debouncedSaveSliceStates = {
  settings: debounce((data: any, namespaces?: string[]) => 
    { saveToStorage('settings', data, namespaces); }, ...DEBOUNCE_STRATEGY_IMPORTANT),
  workspace: debounce((data: any, namespaces?: string[]) => 
    { saveToStorage('workspace', data, namespaces); }, ...DEBOUNCE_STRATEGY_IMPORTANT),
  ui: debounce((data: any, namespaces?: string[]) => 
    { saveToStorage('ui', data, namespaces); }, ...DEBOUNCE_STRATEGY_FREQUENT),
  user: debounce((data: any, namespaces?: string[]) => 
    { saveToStorage('user', data, namespaces); }, ...DEBOUNCE_STRATEGY_IMPORTANT),
  lib: debounce((data: any, namespaces?: string[]) => 
    { saveToStorage('lib', data, namespaces); }, ...DEBOUNCE_STRATEGY_IMPORTANT),
  doc: debounce((data: any, namespaces?: string[]) => 
    { saveToStorage('doc', data, namespaces); }, ...DEBOUNCE_STRATEGY_IMPORTANT),
  tab: debounce((data: any, namespaces?: string[]) => 
    { saveToStorage('tab', data, namespaces); }, ...DEBOUNCE_STRATEGY_IMPORTANT),
  tree: debounce((data: any, namespaces?: string[]) => 
    { saveToStorage('tree', data, namespaces); }, ...DEBOUNCE_STRATEGY_FREQUENT),
}

function loadFromStorage<T>(key: string, initialState: T, namespaces?: string[]): T {
  const exists = window.eidux.exists(key, namespaces);
  Logger.debug(`Loading ${key} state from storage: exists = ${exists}`);
  if (!exists)
    return initialState;

  const loaded = window.eidux.load(key, namespaces);
  if (!loaded) {
    Logger.warn('Failed to load ${key} state, returning null');
    return initialState;
  }

  // 以 initialState 为基础，合并加载的状态
  const copy = JSON.parse(JSON.stringify(initialState));
  return Object.assign(copy, loaded) as T;
}

function saveToStorage<T>(key: string, data: T, namespaces?: string[]) {
  try {
    // Logger.debug(`Saving ${key} state to storage`);
    window.eidux.save(key, data, namespaces);
  } catch (err) {
    Logger.error('Failed to save ${key} state to storage:', err);
  }
}

// 加载所有需要持久化的状态，没有的则返回初始状态
export function loadState(): RootState {
  const initialState = {
    settings: settingsInitialState,
    workspace: workspaceInitialState,
    ui: uiInitialState,
    user: userInitialState,
    lib: libInitialState,
    doc: docInitialState,
    tab: tabInitialState,
    tree: treeInitialState,
    dialog: dialogInitialState,
    runtime: runtimeInitialState,
    connection: connectionInitialState,
    agent: agentInitialState,
  };

  // 加载 settings 状态，这个只有一份全局的
  const settings = loadFromStorage('settings', initialState.settings, ['default']);
  // 加载 user 状态，这个也是全局的
  const user = loadFromStorage('user', initialState.user, ['default']);
  // 加载 workspace 状态，其他下面的信息都包在 workspace 里
  // 目前永远只有一个缺省的 'default' workspace
  const workspace = loadFromStorage('workspace', initialState.workspace, ['default']);
  // 根据 workspace 信息，加载 ui 状态
  const ui = loadFromStorage('ui', initialState.ui, [workspace.id]);
  // 根据 workspace 信息，加载 包含的 lib 信息
  const lib = loadFromStorage('lib', initialState.lib, [workspace.id]);
  // 根据 workspace 信息，加载 doc 状态，并清理失效项(不在lib里/不在文件系统里等)
  const doc = loadFromStorage('doc', initialState.doc, [workspace.id]);
  // 根据 workspace 信息，加载 tab 状态，并清理失效项(不在 doc 里等)
  const tab = loadFromStorage('tab', initialState.tab, [workspace.id]);
  // 根据 lib 信息，加载 tree 状态，并清理失效项(不在lib里/不在文件系统里等)
  const tree = loadFromStorage('tree', initialState.tree, [workspace.id]);

  // 以下无需持久化，直接用初始状态
  const dialog = initialState.dialog;
  const runtime = initialState.runtime;
  const connection = initialState.connection;
  const agent = initialState.agent;

  return {
    settings,
    workspace,
    ui,
    user,
    lib,
    doc,
    tab,
    tree,
    dialog,
    runtime,
    connection,
    agent,
  };
}

// 保存所有需要持久化的状态
export function saveState(state: RootState) {
  saveToStorage('settings', state.settings);
  saveToStorage('workspace', state.workspace);
  saveToStorage('ui', state.ui);
  saveToStorage('user', state.user);
  saveToStorage('lib', state.lib);
  saveToStorage('doc', state.doc);
  saveToStorage('tab', state.tab);
  saveToStorage('tree', state.tree);
  // dialog 和 runtime 不持久化
}
