// 用户相关的类型定义

export interface UserProfile {
  id: string
  email: string
  name?: string
  avatar?: string
  provider: 'google' | 'github' | 'email'
  created_at: string
  updated_at: string
}

export interface UserSubscription {
  id: string
  user_id: string
  plan_type: 'free' | 'pro' | 'enterprise'
  status: 'active' | 'canceled' | 'expired' | 'trial'
  current_period_start: string
  current_period_end: string
  cancel_at_period_end: boolean
}

export interface UserCredits {
  id: string
  user_id: string
  total_credits: number
  used_credits: number
  bonus_credits: number
  bonus_expiry?: string
  reset_date: string
  last_updated: string
}

export interface UserInfo {
  profile: UserProfile
  subscription: UserSubscription
  credits: UserCredits
}

export interface AuthState {
  isAuthenticated: boolean
  user: UserProfile | null
  loading: boolean
  error: string | null
}