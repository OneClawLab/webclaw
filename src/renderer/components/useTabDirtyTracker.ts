import { useCallback, useRef } from 'react'
import { debounce, DEBOUNCE_DIRTY_FALSE, DEBOUNCE_DIRTY_TRUE } from '@lib/debounce.js'
import { useAppDispatch } from '@state/storeHolder.js'
import { tabActions } from '@state/slices/tab/slice.js'

// 用于跟踪 Tab 的脏状态的 Hook, 但其实我们跟踪的是 Doc 的脏状态
// 每次改变 都是 改变所有与 docId 相关的 Tab 的脏状态
export function useTabDirtyTracker(docId: string) {
  const appDispatch = useAppDispatch()

  // _setDirty 函数只会被创建一次并记录在实例中
  const _setDirty = useCallback((docId: string, value: boolean) => {
      appDispatch(tabActions.markTabsDirtyForDoc({ docId, dirty: value }))
  }, [appDispatch])

  // 以下都在 docId变化时会重建

  const markDirty = useCallback((value: boolean) => { _setDirty(docId, value) }, [_setDirty, docId])
  const markDirtyTrueDebounced = useCallback(() => { debounce(() => { _setDirty(docId, true) }, ...DEBOUNCE_DIRTY_TRUE)() }, [_setDirty, docId])
  const markDirtyFalseDebounced = useCallback(() => { debounce(() => { _setDirty(docId, false) }, ...DEBOUNCE_DIRTY_FALSE)() }, [_setDirty, docId])

  return {
    markDirty,
    markDirtyTrueDebounced,
    markDirtyFalseDebounced,
  }
}
