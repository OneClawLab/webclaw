// HotkeyProvider         // 创建和提供上下文
// ├── HotkeyContext      // 提供全局共享的 HotkeyManager
// │   └── HotkeyManager  // 真正负责注册/执行/查询所有快捷键
// ├── useHotkeyManager() // 提供对 HotkeyManager 的访问

import { useContext, createContext } from 'react'
import { HotkeyManager } from './HotkeyManager.js'

export const HotkeyContext = createContext<HotkeyManager | null>(null)

export function useHotkeyManager() {
  const ctx = useContext(HotkeyContext)
  if (!ctx) 
    throw new Error('useHotkeyManager must be used inside HotkeyProvider')
  return ctx
}
