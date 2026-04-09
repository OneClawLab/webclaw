export interface UserState {
  // 当前登录用户的基本信息
  userId: string              // 用户唯一ID，未登录时为 'guest'
  isAuthenticated: boolean    // 是否已登录
  email?: string             // 用户邮箱
  name?: string              // 用户姓名
  avatar?: string            // 用户头像URL
  provider?: 'google' | 'github' | 'email'  // 登录方式
  
  // 用户状态
  loading: boolean           // 是否正在加载用户信息
  error: string | null       // 错误信息
}

export const initialState: UserState = {
  userId: 'guest',
  isAuthenticated: false,
  loading: false,
  error: null
}