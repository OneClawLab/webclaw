import { Logger, Assert } from '@lib/logast.js'
import { configureStore } from '@reduxjs/toolkit'
import { rootReducer } from '@state/reducers.js'

import { initPrevPersistentState, loadState, selectPersistentState } from '@state/persistent.js'

import persistMiddleware from '@state/middlewares/persistMiddleware.js'
import loggingMiddleware from '@state/middlewares/loggingMiddleware.js'

// 创建 Redux store
export function createStore() {
  // 加载各种持久化的状态
  const loadedState = loadState();
  Assert.isDefined(loadedState, 'Failed to load persistent state');
  // Logger.info('Loaded persistent state:', loadedState);

  // 创建 Redux store
  const store = configureStore({
    // rootReducer 包含了所有的 slice reducer
    // RootState (也就是store.getState()返回的) 的类型是从 rootReducer 推导出来的
    reducer: rootReducer,

    // 加载各种中间件
    middleware: getDefaultMiddleware => 
      getDefaultMiddleware({
        immutableCheck: false,
        // 忽略某些 action 和 state path 的序列化不规范检查(反正我们也不会序列化它们)
        serializableCheck: {
          ignoredActions: ['dialog/showModal','dialog/hideModal'],
          ignoredPaths: ['dialog.modals']
        }
      })
      .concat(persistMiddleware)
      .concat(loggingMiddleware),
    // 恢复保存的状态
    // 每一项必须和 rootReducer 中的 slice 名称一致。
    // 亦即和RootState 中的键一致，因为RootState 是从 rootReducer 推导出来的。
    preloadedState: {
      ...loadedState
    }
  });

  // 记录初始化后的状态，用于后续的变化检测和持久化保存
  const state = selectPersistentState(store.getState());
  initPrevPersistentState(state);
  // Logger.info('Initialized persistent state:', state);

  return store;
}
