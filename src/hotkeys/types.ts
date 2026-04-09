/**
 * Represents a hotkey command configuration.
 * 
 * @property id - Unique identifier for the hotkey command.
 * @property keys - Key or keys that trigger the command.
 *   - Can be a single string (e.g., "Mod+S") or an array of strings (e.g., ["Mod+S", "Cmd+S"]).
 *   - Supports modifier keys (Ctrl, Alt, Shift, Cmd) and key combinations.
 *   - Example: "Mod+Shift+K", ["Mod+S", "Cmd+S"].
 * @property callback - Function to execute when the hotkey is triggered.
 * @property scope - (Optional) Scope in which the hotkey is active.
 *   - Defines the context where the hotkey works.
 *   - Common values: "global" (entire app), "editor" (text editor area), "modal" (active dialog), etc.
 *   - Can be customized based on application needs.
 * @property description - (Optional) Description of the hotkey command.
 *   - Used for documentation or help UI.
 * @property group - (Optional) Group name for organizing hotkeys.
 *   - Used to categorize hotkeys (e.g., "File", "Edit", "Navigation").
 *   - Helpful for displaying hotkeys in grouped lists or settings.
 */
export interface HotkeyCommand {
  id: string
  keys: string | string[]
  callback: (...args: any[]) => void // 允许任意可选参数

  capture?: boolean       // 是否在捕获阶段处理事件，默认为 false
  scope?: string          // 热键作用域，默认为 'all'，表示全局任何地方都有效
  description?: string
  group?: string
}
