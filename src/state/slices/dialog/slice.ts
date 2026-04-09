import { Logger } from '@lib/logast.js'
import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { ConfirmPayload, DialogState, initialState, NotificationInfo, ToastInfo } from './types.js'

const dialogSlice = createSlice({
  name: 'dialog',
  initialState,
  reducers: {
    showToast(state, action: PayloadAction<Omit<ToastInfo, 'id'>>) {
      const id = Date.now().toString()
      // 如果 同样参数的 toast 已存在，则不重复添加
      const exists = state.toasts.find(
        (t) =>
          t.type === action.payload.type &&
          t.msg === action.payload.msg &&
          t.title === action.payload.title &&
          t.duration === action.payload.duration
      )
      // 覆盖已有的 toast id，使其重新计时
      if (exists) {
        exists.id = id
        Logger.debug('dialogSlice', 'showToast: toast already exists, updating id to reset duration', { toast: exists })
        return
      }
      // 添加新 toast
      state.toasts.push({ ...action.payload, id })
    },
    removeToast(state, action: PayloadAction<string>) {
      state.toasts = state.toasts.filter((t) => t.id !== action.payload)
    },
    showNotification(state, action: PayloadAction<NotificationInfo>) {
      state.notifications.push(action.payload)
    },
    removeNotification(state, action: PayloadAction<string>) {
      state.notifications = state.notifications.filter((n) => n.id !== action.payload)
    },
    showConfirm(state, action: PayloadAction<ConfirmPayload>) {
      //Logger.debug('dialogSlice', 'showConfirm called');
      state.confirm = action.payload
    },
    hideConfirm(state, action: PayloadAction<void>) {
      //Logger.debug('dialogSlice', 'hideConfirm called');
      state.confirm = undefined
    },
    showModal(state, action: PayloadAction<{ id: string; type: string; props?: any }>) {
      state.modals[action.payload.id] = { type: action.payload.type, props: action.payload.props }
    },
    hideModal(state, action: PayloadAction<string>) {
      delete state.modals[action.payload]
    },
  },
});

export const dialogActions = dialogSlice.actions
export default dialogSlice.reducer
