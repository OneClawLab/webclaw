import { Logger } from '@lib/logast.js'
import { withLogging } from '@lib/renderer/withLogging.js'

import React, { useEffect, Suspense, lazy, useRef } from 'react'
import { useAppDispatch, useAppSelector } from '@state/storeHolder.js'
import { resolveConfirm } from '@lib/renderer/dialog.js'
import { dialogActions } from '@state/slices/dialog/slice.js'
import { dispatchAppCommand } from '@commands/registry.js'

// 动态组件映射
const modalComponents: Record<string, React.LazyExoticComponent<React.ComponentType<any>>> = {
  'command-palette': lazy(() =>
    import('../modals/CommandPalette.js').then(module => ({
      default: module.default as unknown as React.ComponentType<any>
    }))
  ),
  'about-dialog': lazy(() =>
    import('../modals/AboutDialog.js').then(module => ({
      default: module.default as unknown as React.ComponentType<any>
    }))
  ),
  'user-info-dialog': lazy(() =>
    import('../modals/UserInfoDialog.js').then(module => ({
      default: module.default as unknown as React.ComponentType<any>
    }))
  ),
  'connection-settings': lazy(() =>
    import('../modals/ConnectionSettings.js').then(module => ({
      default: module.default as unknown as React.ComponentType<any>
    }))
  ),
  // 其他modal类型可以继续添加
}

function DialogSystemBase(): React.JSX.Element {
  const dispatch = useAppDispatch()
  const { toasts, confirm, modals, notifications } = useAppSelector(state => state.dialog)

  // 用 toastId -> timeoutId 来避免每次 toasts 变化都重置所有计时器
  const toastTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  // notificationId -> timeoutId（仅对配置了 duration 的 notification 生效）
  const notificationTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    const timers = toastTimersRef.current

    // 1) 为新 toast 设置定时器
    for (const t of toasts) {
      if (timers.has(t.id)) continue

      const timeoutId = setTimeout(() => {
        dispatch(dialogActions.removeToast(t.id))
        timers.delete(t.id)
      }, t.duration ?? 3000)

      timers.set(t.id, timeoutId)
    }

    // 2) 清理已经不存在的 toast 的定时器
    const currentIds = new Set(toasts.map(t => t.id))
    for (const [id, timeoutId] of timers.entries()) {
      if (currentIds.has(id)) continue
      clearTimeout(timeoutId)
      timers.delete(id)
    }

    // 组件卸载或 effect 重跑时清理所有定时器（针对这个 snapshot）
    return () => {
      for (const timeoutId of timers.values()) clearTimeout(timeoutId)
      timers.clear()
    }
  }, [dispatch, toasts])

  // notification：仅当 duration 存在时自动消失
  useEffect(() => {
    const timers = notificationTimersRef.current

    // 1) 为新 notification 设置定时器（仅 duration 存在）
    for (const n of notifications) {
      if (!n.duration) continue
      if (timers.has(n.id)) continue

      const timeoutId = setTimeout(() => {
        dispatch(dialogActions.removeNotification(n.id))
        timers.delete(n.id)
      }, n.duration * 1000)

      timers.set(n.id, timeoutId)
    }

    // 2) 清理已经不存在的 notification 的定时器
    const currentIds = new Set(notifications.map(n => n.id))
    for (const [id, timeoutId] of timers.entries()) {
      if (currentIds.has(id)) continue
      clearTimeout(timeoutId)
      timers.delete(id)
    }
  }, [dispatch, notifications])

  // 仅在卸载时清理（避免每次变更都重置倒计时）
  useEffect(() => {
    // Snapshot the current maps so cleanup uses stable references
    const toastTimers = toastTimersRef.current
    const notificationTimers = notificationTimersRef.current

    return () => {
      for (const timeoutId of toastTimers.values()) clearTimeout(timeoutId)
      toastTimers.clear()

      for (const timeoutId of notificationTimers.values()) clearTimeout(timeoutId)
      notificationTimers.clear()
    }
  }, [])

  // confirm 对话框的键盘事件处理
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!confirm) return

      // 如果事件已被 HotkeyManager 处理，则不处理
      if ((e as any).__handledByHotkeyManager) return

      if (e.key === 'Escape') {
        resolveConfirm('Cancel')
        dispatch(dialogActions.hideConfirm())
      }
      if (e.key === 'Enter') {
        resolveConfirm(confirm.buttons[0].value)
        dispatch(dialogActions.hideConfirm())
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [confirm, dispatch])

  return (
    <>
      {/* Notifications (persistent) */}
      <div
        id="Notifications"
        className="
          fixed right-3 z-50
          flex flex-col items-end space-y-3
          max-w-md w-md
          pointer-events-none
        "
        style={{
          // statusbar 实际占用：height + padding-top + padding-bottom
          bottom:
            'calc(var(--statusbar-height, 24px) + var(--statusbar-padding-top, 0px) + var(--statusbar-padding-bottom, 0px) + var(--statusbar-safe-gap, 8px))',
          // 右侧对齐：默认跟 StatusBar 的右 padding 对齐
          marginRight: 'var(--statusbar-notification-right-offset, 1rem)',
        }}
      >
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`
              pointer-events-auto w-full
              flex gap-3 px-5 py-3 rounded-xl
              bg-white/95 border border-gray-200 shadow-[0_2px_10px_rgba(0,0,0,0.08)]
              ${
                n.type === 'success'
                  ? 'border-l-4 border-green-400/80'
                  : n.type === 'error'
                  ? 'border-l-4 border-red-400/80'
                  : n.type === 'warn'
                  ? 'border-l-4 border-amber-400/80'
                  : n.type === 'hint'
                  ? 'border-l-4 border-blue-400/80'
                  : 'border-l-4 border-gray-500'
              }
            `}
          >
            <div
              className={`
                text-lg leading-none mt-0.5
                ${
                  n.type === 'success'
                    ? 'text-green-500'
                    : n.type === 'error'
                    ? 'text-red-500'
                    : n.type === 'warn'
                    ? 'text-amber-500'
                    : n.type === 'hint'
                    ? 'text-blue-500'
                    : 'text-gray-500'
                }
              `}
            >
              {n.type === 'success'
                ? '✔'
                : n.type === 'error'
                ? '✖'
                : n.type === 'warn'
                ? '⚠'
                : n.type === 'hint'
                ? '💡'
                : 'ℹ'}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {n.title && (
                    <div className="font-medium text-sm leading-tight mb-0.5 text-gray-800 truncate">
                      {n.title}
                    </div>
                  )}
                  <div className="text-[0.95rem] leading-snug text-gray-600 whitespace-pre-line break-word">
                    {n.msg}
                  </div>
                </div>

                <button
                  aria-label="Dismiss notification"
                  onClick={() => dispatch(dialogActions.removeNotification(n.id))}
                  className="shrink-0 px-2 py-1 text-gray-400 hover:text-gray-700"
                >
                  ×
                </button>
              </div>

              {!!n.actions?.length && (
                <div className="mt-2 flex flex-wrap justify-end gap-2">
                  {n.actions.map((a, idx) => (
                    <button
                      key={`${n.id}:${idx}:${a.command}`}
                      onClick={() => { dispatchAppCommand(a.command, a.payload); }}
                      className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 text-sm"
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              )}

              {n.meta && (
                <details className="mt-2 text-xs text-gray-500">
                  <summary className="cursor-pointer select-none">meta</summary>
                  <pre className="mt-1 overflow-auto whitespace-pre-wrap break-word">
                    {JSON.stringify(n.meta, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Toasts */}
      <div
        id="Toasts"
        className="
          fixed bottom-8 left-1/2 -translate-x-1/2 z-50
          flex flex-col items-center space-y-3
          pointer-events-none
        "
      >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`
            flex items-start gap-3 px-5 py-3 rounded-xl pointer-events-auto max-w-md w-full
            transition-all duration-300 transform
            animate-toast-in
            bg-white/95 border border-gray-200 shadow-[0_2px_10px_rgba(0,0,0,0.08)]
            ${
              t.type === 'success'
                ? 'border-l-4 border-green-400/80'
                : t.type === 'error'
                ? 'border-l-4 border-red-400/80'
                : t.type === 'warn'
                ? 'border-l-4 border-amber-400/80'
                : t.type === 'hint'
                ? 'border-l-4 border-blue-400/80'
                : 'border-l-4 border-gray-500'
            }
          `}
        >
          <div
            className={`
              text-lg leading-none mt-0.5
              ${
                t.type === 'success'
                  ? 'text-green-500'
                  : t.type === 'error'
                  ? 'text-red-500'
                  : t.type === 'warn'
                  ? 'text-amber-500'
                  : t.type === 'hint'
                  ? 'text-blue-500'
                  : 'text-gray-500'
              }
            `}
          >
            {t.type === 'success'
              ? '✔'
              : t.type === 'error'
              ? '✖'
              : t.type === 'warn'
              ? '⚠'
              : t.type === 'hint'
              ? '💡'
              : 'ℹ'}
          </div>

          <div className="flex-1 text-gray-800">
            {t.title && (
              <div className="font-medium text-sm leading-tight mb-0.5">
                {t.title}
              </div>
            )}
            <div className="text-[0.95rem] leading-snug text-gray-600">
              {t.msg}
            </div>
          </div>
        </div>
      ))}
      </div>

      {/* Confirm Dialog */}
      {confirm && (
        <div id='Confirm' className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
          <div className="bg-white p-4 rounded-xl w-100 shadow-xl animate-fadeIn">
            <h2 className="text-lg font-bold mb-4">{confirm.title}</h2>
            <p className="text-sm text-gray-600">{confirm.message}</p>
            <div className="flex justify-end min-h-4"/>
            <div className="flex justify-end gap-2">
              {confirm.buttons.map((btn) => (
                <button
                  key={btn.label}
                  autoFocus={btn.isPrimary}
                  onClick={() => {
                    resolveConfirm(btn.value)
                    dispatch(dialogActions.hideConfirm())
                  }}
                  className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {Object.entries(modals).map(([id, modal]) => {
        if (!modal) return null
        const ModalComponent = modalComponents[modal.type]
        if (!ModalComponent) return null
        return (
          <Suspense name='{id}' key={id} fallback={null}>
            <ModalComponent {...modal.props} />
          </Suspense>
        )
      })}
    </>
  )
}

export const DialogSystem = withLogging(DialogSystemBase, { name: 'DialogSystem' })
