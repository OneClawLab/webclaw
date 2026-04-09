/* eslint-disable react/prop-types */
import { useMemo } from 'react'
import { HotkeyManager } from './HotkeyManager.js'
import { HotkeyContext } from './useHotkeyManager.js'

// HotkeyProvider 用于创建和提供全局热键管理上下文
// 通过 useMemo 确保 HotkeyManager 实例在组件生命周期内只创建一次
// 这样可以避免每次渲染都创建新的实例，提升性能
export const HotkeyProvider = ({ children }) => {
  const manager = useMemo(() => new HotkeyManager(), [])
  return <HotkeyContext.Provider value={manager}>{children}</HotkeyContext.Provider>
}
