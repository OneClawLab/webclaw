// VERSION 化的 boolean 控制参数
// 原理：
//   使用一个整数值来表示功能的启用状态
//   通过比较实际值和当前版本值来确定功能状态
//   实际值小于当前版本值时，表示启用该功能，否则表示禁用该功能
//   可以通过增加当前版本值来强制所有用户重新启用该功能

export const VERSION_SHOW_WELCOME_ON_STARTUP = 2;
export const VERSION_CHECK_FOR_UPDATES = 1;
export const VERSION_AUTO_INSTALL_UPDATES = 1;

export function isFeatureEnabled(actualValue: number, currentVersion: number): boolean {
  return actualValue < currentVersion;
}

export function setFeatureEnabled(enabled: boolean, currentVersion: number): number {
  return enabled ? 0 : currentVersion;
}

///////////////////////////////////////////////////////////////////////////////////

// settings slice 的状态
export interface SettingsState {
  // theme: 'light' | 'dark';      // 主题，'light' 或 'dark'
  // autoSaveInterval: number;     // 自动保存间隔，单位为秒，0表示不自动保存
  // enableNotifications: boolean; // 是否启用通知

  showWelcomeOnStartup: number;    // 启动时是否自动打开并显示欢迎文档
  checkForUpdates: number;         // 是否检查更新并提示用户, 目前只控制是否通知/底层仍然会检查更新
  autoInstallUpdates: number;      // 是否自动安装更新包

  language: string;                // 语言设置: 'auto' 表示跟随系统，或具体语言代码如 'en', 'zh'
  
  aiStatus: AiStatus;              // AI服务的状态
  frontAgentName: string;          // AI会话调用的 前端 Agent 的名称
  progressMode: 'simple' | 'verbose'; // AI响应的进度显示模式
}

export const initialState: SettingsState = {
  showWelcomeOnStartup: 0,       // 默认为启用
  checkForUpdates: 0,            // 默认为启用
  autoInstallUpdates: 0,         // 默认为启用  
  language: 'auto',              // 默认跟随系统语言
  aiStatus: 'unconfigured',
  frontAgentName: 'normal',
  progressMode: 'simple',
};
