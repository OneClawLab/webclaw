// 此文件在 main 进程和 renderer 进程均有用到
// 注: 必须保证能先于 main/renderer 进程代码可用
import i18next from 'i18next';
import en from './locales/en.json' with { type: "json" };
import zh from './locales/zh.json' with { type: "json" };
import { OS, ELECTRON_CONTEXT } from '@lib/env.js';

////////////////////////////////////////////////////////////////////////
/// 语言切换支持
////////////////////////////////////////////////////////////////////////

// 支持的语言列表
export const SUPPORTED_LANGUAGES = {
  en: 'English',
  zh: '中文',
} as const;

export type SupportedLanguage = keyof typeof SUPPORTED_LANGUAGES;

// 检测操作系统默认语言
function detectOSLanguage(): SupportedLanguage {
  let osLang = 'en'; // 默认fallback

  try {
    if (ELECTRON_CONTEXT === 'renderer' && typeof window !== 'undefined' && window.navigator) {
      // 在渲染进程中使用 navigator.language
      osLang = window.navigator.language;
    } else if (ELECTRON_CONTEXT === 'main' || ELECTRON_CONTEXT === 'preload') {
      // 在主进程或预加载脚本中使用 process.env
      const _process = (globalThis as any)?.process;
      if (_process?.env) {
        osLang = _process.env.LANG || _process.env.LANGUAGE || _process.env.LC_ALL || 'en';
      }
    }

    // 将OS语言代码映射到支持的语言
    const langCode = osLang.toLowerCase();
    if (langCode.startsWith('zh')) {
      return 'zh';
    } else if (langCode.startsWith('en')) {
      return 'en';
    }
    
    // 其他语言默认使用英文
    return 'en';
  } catch (error) {
    console.warn('[i18n] Failed to detect OS language:', error);
    return 'en';
  }
}

// 解析语言设置，返回实际要使用的语言
export function resolveLanguage(languageSetting: string): SupportedLanguage {
  if (languageSetting === 'auto')
    return detectOSLanguage();
  // 检查是否是支持的语言
  if (languageSetting in SUPPORTED_LANGUAGES)
    return languageSetting as SupportedLanguage;
  // 不支持的语言，fallback到英文
  return 'en';
}

// 初始化i18n，使用检测到的OS语言
const initialLanguage = detectOSLanguage();

i18next.init({
  lng: initialLanguage,
  fallbackLng: 'en',
  debug: false,   // 关闭详细调试日志
  saveMissing: true,  // 启用缺失 key 检测
  missingKeyHandler: (lng, _ns, key, _fallbackValue) => {
    console.warn(`[i18n] Missing translation key: ${key} for language: ${lng}`);
  },
  resources: {
    en: { translation: en },
    zh: { translation: zh },
  },
  interpolation: {
    escapeValue: false,
  },  
});

// 更改语言的函数
export function changeLanguage(languageSetting: string): Promise<void> {
  const actualLanguage = resolveLanguage(languageSetting);
  return i18next.changeLanguage(actualLanguage).then(() => {});
}

// 获取当前语言
export function getCurrentLanguage(): SupportedLanguage {
  return i18next.language as SupportedLanguage;
}

////////////////////////////////////////////////////////////////////////
/// 字符串翻译支持(支持混合模式)
////////////////////////////////////////////////////////////////////////

type I18nKey = `i18n:${string}`;
type AdaptiveText = I18nKey | string;

// 声明函数：给一个KEY打上 i18n 标记
// 用于定义的地方
export function k18(key: string): I18nKey {
  return `i18n:${key}`;
}

// 翻译函数：智能识别是 KEY 还是 Literal String
// 用于渲染的地方，暂不支持模板字符串
export function a18(text: AdaptiveText): string {
  // 1. 如果不是 i18n 前缀，直接当作 Literal String 返回
  if (typeof text !== 'string' || !text.startsWith('i18n:'))
    return text;

  // 2. 提取真正的 key
  const key = text.substring(5);

  // 3. 调用 i18next
  // 这里可以利用 i18next 的 defaultValue 特性：
  // 如果 key 找不到，直接返回 key 原文（或者您可以自定义 fallback）
  return i18next.t(key, { defaultValue: key });
}

// 常规翻译函数，用于明确需要从KEY转成本地化字符串时
// 这个函数也支持带参数的模板字符串
export const t = i18next.t.bind(i18next);

////////////////////////////////////////////////////////////////////////
/// 热键字符串翻译
////////////////////////////////////////////////////////////////////////

// 把内部热键标识串转换为用户可读的形式
// 内部术语:  Mod/Alt/Shift, Mod+Shift+S
// 用户可读:  Ctrl/Alt/Shift, Ctrl+Shift+S  (Windows/Linux)
//          ⌘/Option/Shift, ⌘+Shift+S      (macOS)
// hotkey -> human readable text
export function hkt(shortcut: string | string[]): string {  
  let str = Array.isArray(shortcut) ? shortcut.map(s => hkt(s)).join(' / ') : shortcut;

  if (OS === 'windows' || OS === 'linux') {
    str = str
      .replace('Mod', 'Ctrl')
      .replace('ArrowUp', '↑').replace('ArrowDown', '↓')
      .replace('ArrowLeft', '←').replace('ArrowRight', '→')
      .replace('Enter', 'Enter↵');
  } else if (OS === 'macos') {
    str = str
      .replace('Mod', '⌘')
      .replace('Alt', 'Option')
      .replace('Shift', '⇧')
      .replace('ArrowUp', '↑').replace('ArrowDown', '↓')
      .replace('ArrowLeft', '←').replace('ArrowRight', '→')
      .replace('Enter', '⏎')
      .replace('Backspace', '⌫').replace('Delete', '⌦')
      .replace('Escape', 'esc')
      .replace('Tab', '⇥');
  } else {
    // noop
  }

  // 把 分隔符的 - 统一显示为 + (但不要动 keyboard 上的 - 键)
  if (str.includes('-+'))         // '-+' means modifier keys AND '+' key
    str = str.replace('-+', '++');
  else if (str.includes('+-')) {} // '+-' means modifier keys AND '-' key
  else if (str.includes('-'))     // normal case, - means AND
    str = str.replace('-', '+');
  return str;
}

// 转换为 macOS 要求的 accelerator 格式 (仅用于主菜单定义, 不是直接用来显示)
// hotkey -> macOS accelerator
export function mac_acc(shortcut: string | string[]): string {
  let str = Array.isArray(shortcut) ? shortcut.map(s => mac_acc(s)).join(', ') : shortcut;  
  if (OS === 'macos') {
    str = str
      .replace('Ctrl', 'Control')
      .replace('Mod', 'Cmd')
      .replace('Alt', 'Option')
      .replace('ArrowUp', 'Up').replace('ArrowDown', 'Down')
      .replace('ArrowLeft', 'Left').replace('ArrowRight', 'Right')
      .replace('Enter', 'Return');
  }
  return str;
}
