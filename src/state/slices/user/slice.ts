import { Logger } from '@lib/logast.js'
import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { initialState, UserState } from './types.js'

const userSlice = createSlice({
  name: 'user',
  initialState: initialState,
  reducers: {
    // 设置用户登录状态
    setUser(state, action: PayloadAction<{
      userId: string
      email: string
      name?: string
      avatar?: string
      provider: 'google' | 'github' | 'email'
    }>) {
      const { userId, email, name, avatar, provider } = action.payload
      state.userId = userId
      state.email = email
      state.name = name
      state.avatar = avatar
      state.provider = provider
      state.isAuthenticated = true
      state.error = null
      Logger.debug('userSlice', 'setUser: user logged in', { userId, email })
    },

    // 更新用户信息
    updateUser(state, action: PayloadAction<{
      name?: string
      avatar?: string
    }>) {
      const { name, avatar } = action.payload
      if (name !== undefined) state.name = name
      if (avatar !== undefined) state.avatar = avatar
      Logger.debug('userSlice', 'updateUser: user info updated', { name, avatar })
    },

    // 用户登出
    signOut(state) {
      Logger.debug('userSlice', 'signOut: user signed out', { userId: state.userId })
      state.userId = 'guest'
      state.isAuthenticated = false
      state.email = undefined
      state.name = undefined
      state.avatar = undefined
      state.provider = undefined
      state.error = null
    },

    // 设置加载状态
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload
    },

    // 设置错误信息
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload
      state.loading = false
    },

    // 清除错误信息
    clearError(state) {
      state.error = null
    }
  }
})

export const userActions = userSlice.actions
export default userSlice.reducer