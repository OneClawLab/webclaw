import { useDispatch, useSelector, TypedUseSelectorHook } from 'react-redux'
import type { AppStore, RootState, AppDispatch } from './types.js';
import { useEffect, useMemo, useRef } from 'react'
import { shallowEqual } from 'react-redux'
import { debounce, DebouncedFunc } from '@lib/debounce.js';

let store: AppStore | undefined = undefined

/**
 * 在应用初始化时调用一次，设置全局 store 实例。
 */
export function setStore(s: AppStore) {
  store = s
}

/**
 * 在任何模块中延迟访问 store。
 * 注意：请确保在使用前，`setStore()` 已经被调用。
 */
export function getStore(): AppStore {
  if (!store)
    throw new Error('Redux store has not been initialized yet. Did you forget to call setStore()?')
  return store
}

// 用于React组件外部 （内部也能用，但不推荐）
export function getState(): RootState {
  return getStore().getState()
}

// 用于React组件外部 （内部也能用，但不推荐）
export function getAppDispatch(): AppDispatch {
  return getStore().dispatch;
}

// 仅用于React组件内部，useDispatch 的类型化版本
export const useAppDispatch = () => useDispatch<AppDispatch>()
// 仅用于React组件内部，useSelector 的类型化版本
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector

// useEffect + 只在组件挂载时执行一次
export function useEffectOnce(effect: () => void | (() => void)) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(effect, []);
}

// useEffect + 使用shallowEqual比较依赖项 (useEffect缺省是 === 比较，即引用相等)
export function useShallowEffect(effect: () => void | (() => void), deps: any[]) {
  const previousDeps = useRef<any[]>([])

  useEffect(() => {
    const isSame = shallowEqual(previousDeps.current, deps)
    
    if (!isSame) {
      previousDeps.current = deps
      return effect()
    }
  }, [effect, deps])
}

// useCallback 的 debounced 版本, 只有 fn/wait/options 变化时才会重新创建
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  fn: T,
  wait: number,
  options?: { leading?: boolean; trailing?: boolean; maxWait?: number }
): DebouncedFunc<T> {
  // 返回的 memoized 函数本身就拥有 cancel、flush、pending
  const debounced = useMemo(() => {
    return debounce(fn, wait, options);
  }, [fn, wait, options]);

  // 组件卸载时自动 cancel
  useEffect(() => {
    return () => {
      debounced.cancel();
    };
  }, [debounced]);

  return debounced;
}
