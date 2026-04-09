export type ToastType = 'info' | 'hint' | 'success' | 'warn' | 'error'

export interface ToastInfo {
  id: string
  type: ToastType
  msg: string
  title?: string
  duration?: number
}

export type ButtonInfo = {
  label: string
  value: string
  isPrimary?: boolean
}

export interface ConfirmPayload {
  title: string
  message: string
  buttons: ButtonInfo[]
}

export interface ModalInfo {
  type: string
  props?: any
}

/**
 * 持久消息（notifications）
 * - 默认持久：不会像 toast 那样自动消失（除非你在 reducer/UI 里显式移除）
 * - 支持可选动作按钮
 */
export type NotificationType = 'info' | 'hint' | 'success' | 'warn' | 'error'

export interface NotificationAction {
  label: string
  command: string       // app command id, 点击后执行该 app command
  payload?: unknown     // 可选：附加负载数据，执行 command 时一并传递
}

export interface NotificationInfo {
  id: string
  type: NotificationType
  title?: string
  msg: string
  duration?: number   // 可选：自动消失时间（秒），不设置则不会自动消失
  actions?: NotificationAction[]
  meta?: Record<string, unknown>
}

export interface DialogState {
  confirm?: ConfirmPayload
  toasts: ToastInfo[]
  notifications: NotificationInfo[]
  modals: Record<string, ModalInfo>
}

export const initialState: DialogState = {
  toasts: [],
  notifications: [],
  modals: {},
}
