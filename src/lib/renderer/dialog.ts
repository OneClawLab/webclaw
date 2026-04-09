import { getNextId } from '@lib/id.js'
import { dialogActions } from '@state/slices/dialog/slice.js'
import { ButtonInfo, ToastType } from '@state/slices/dialog/types.js'
import { getAppDispatch, getStore } from '@state/storeHolder.js'

////////////////////////////////////////////////////////////////////////////////
// toast 模块的辅助函数
////////////////////////////////////////////////////////////////////////////////

export const toast = {
  // 显示一个 短暂时间后会自动消失的 提示, 同参数的 toast 如果已存在则会重新计时
  show: (msg: string, type: ToastType = 'info', title?: string, duration?: number) => {
    const dispatch = getAppDispatch();
    dispatch(dialogActions.showToast({ type, msg, title, duration }));
  }
}

////////////////////////////////////////////////////////////////////////////////
// notification 模块的辅助函数
////////////////////////////////////////////////////////////////////////////////

export const notification = {
  // 显示一个 需要手动关闭的 通知，返回该通知的 id
  show: (info: {
    type: ToastType
    msg: string
    title?: string
    detail?: string
    duration?: number
    actions?: { label: string; command: string; payload?: unknown }[]
    meta?: Record<string, unknown>
  }): string => {
    const id = getNextId('notification', 'ntf');
    const dispatch = getAppDispatch();
    dispatch(dialogActions.showNotification({ id, ...info }));
    return id
  },
  // 关闭一个通知
  remove: (id: string) => {
    const dispatch = getAppDispatch();
    dispatch(dialogActions.removeNotification(id));
  },
}

////////////////////////////////////////////////////////////////////////////////
// dialog 模块的辅助函数
////////////////////////////////////////////////////////////////////////////////

// 此全局变量用于记录(当前唯一活跃的)确认对话框的 resolve 函数
let resolver: ((value: string) => void) | null = null

// 供对话框组件调用的函数，用于处理确认对话框的结果
export function resolveConfirm(value: string) {
  resolver?.(value)
  resolver = null
}

export const dialog = {
  // 异步显示一个确认对话框，返回用户点击的按钮文本
  confirm: (options: { title: string; message: string; buttons: ButtonInfo[] }) =>
    new Promise<string>((resolve) => {
      // 把 resolve 函数保存到全局变量中，以便在确认对话框关闭时调用
      resolver = resolve
      getStore().dispatch(dialogActions.showConfirm(options))
    }),
  showModal: (options: { id: string; type: string; props?: any }) => {
    if (!getStore().getState().dialog.modals[options.id]) {
      getStore().dispatch(dialogActions.showModal(options))
    }
  },
  hideModal: (id: string) => getStore().dispatch(dialogActions.hideModal(id)),
}
