////////////////////////////////////////////

import { path } from "./path.js"

export function throttle<T extends (...args: any[]) => void>(fn: T, wait: number): T {
  let lastTime = 0
  return function (...args: any[]) {
    const now = Date.now()
    if (now - lastTime >= wait) {
      lastTime = now
      fn(...args)
    }
  } as T
}

////////////////////////////////////////////

// JSON deep clone，适用于纯 JSON 对象
// 注意：此方法不适用于包含函数、日期、正则表达式等非纯 JSON 对象
export function clone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

////////////////////////////////////////////

// 从调用栈中获取当前React组件的名称
// TODO HACK: 目前硬编码了调用者的方法名称，如useStateX/useEffectX等。
export function getComponentNameFromStack(): string {
  const stack = new Error().stack;
  if (!stack) return 'UnknownComponent';
  const lines = stack.split('\n');
  for (const line of lines) {
    const match = line.match(/at (\w+)/);
    if (match && !['getComponentNameFromStack', 'useStateX', 'useEffectX', 'Object.<anonymous>'].includes(match[1])) {
      return match[1];
    }
  }
  return 'UnknownComponent';
}

////////////////////////////////////////////
// 对象浅比较（shallow compare）：只比较对象的第一层属性值，
// 不递归比较嵌套对象或数组。返回所有发生变化的属性名列表。
// 如果对象引用相同，则认为没有变化。
// 如果有一个不是对象（如 null、undefined 或基本类型），则认为整体变化。
export function shallowCompare(prev: any, next: any): string[] {
  // 如果引用相同，则没有变化
  if (prev === next)
    return [];

  // 如果 prev 或 next 其中一个为 null、undefined，或者不是对象（如基本类型），
  // 说明无法进行属性级比较，整体发生变化。返回原因字符串，包含类型信息，便于调试。
  if (
    !prev || !next ||
    typeof prev !== 'object' || typeof next !== 'object'
  ) {
    return [
      `<entire object: prev=${prev === null ? 'null' : typeof prev}, next=${next === null ? 'null' : typeof next}>`
    ];
  }

  const changed: string[] = [];
  // 遍历 next 的所有属性键
  for (const key of Object.keys(next))
    // 如果对应属性值不同，则认为该属性变化
    if (prev[key] !== next[key]) 
      changed.push(key);
  // 返回所有变化的属性名
  return changed;
}

// 判断是否为普通对象（非数组、非null、非函数等）,即只有 { ... } 表示的对象
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  return Object.getPrototypeOf(value) === Object.prototype;
}

// 把字符串中的实际换行符转换为文字形式的 \n，用以安全地在单行文本中表示换行
export function escapeNewlines(str: string): string {
  return str.replace(/\r\n|\r|\n/g, '\\n');
}

// 把字符串中的文字形式的 \\n 或 \n 转换为实际的换行符，以及修正 \" 为 "。
// 目的是为了让人看起来更舒服一些，但要注意，这破坏了原字符串的可解析性。
export function beautifyEscapedTexts(str: string): string {
  return str
    .replace(/\\\\n/g, '\\n') // 先把 \\n 变成 \n 这个转义序列
    .replace(/\\n/g, '\n')    // 再把 \n 替成真换行
    .replace(/\\"/g, '"');    // 修正转义引号
}

////////////////////////////////////////////

/**
 * 截取长字符串，保留前后若干字符，中间用...
 * @param str 原始字符串
 * @param headLen 前面保留字符数
 * @param tailLen 后面保留字符数
 */
export function truncateMiddle(str: any, headLen = 100, tailLen = 100): string {
  if (str === undefined || str === null) return '';
  if (typeof str === 'number' || typeof str === 'boolean')
    return str.toString();

  if (str instanceof Object) {
    try {
      str = JSON.stringify(str, null, 2);
    } catch {
      str = String(str);
    }
  }

  if (typeof str !== 'string')
    str = String(str);

  if (str.length <= headLen + tailLen + 5) return str; // 不需要截断
  const head = str.slice(0, headLen);
  const tail = str.slice(str.length - tailLen);
  const ignored = str.length - headLen - tailLen;
  return `${head}(...${ignored}...)${tail}`;
}

export function truncateTail(str: any, headLen = 100): string {
  if (str === undefined || str === null) return '';
  if (typeof str === 'number' || typeof str === 'boolean')
    return str.toString();

  if (str instanceof Object) {
    try {
      str = JSON.stringify(str, null, 2);
    } catch {
      str = String(str);
    }
  }
  
  if (typeof str !== 'string')
    str = String(str);
  if (str.length <= headLen + 5) return str; // 不需要截断
  const head = str.slice(0, headLen);
  const ignored = str.length - headLen;
  return `${head}...(${ignored})`;
}

// 把任意可打印字符串转换为合法的文件名
export function safeFileName(title: string): string {
  // 替换 Windows 不允许的字符为短线，并去掉首尾空白
  return title.replace(/[<>:"/\\|?*]/g, "-").trim();
}

// 去掉string前后的各种引号
export function unwrapString(raw: string): string {
  return raw.trim().replace(/^['"]+|['"]+$/g, "");
}

// 统计字符串末尾连续的换行符数量，按需忽略末尾的空白字符
export function countTrailingCrlfs(str: string, ignoreWhiteSpaces: boolean): number {
  let count = 0;
  for (let i = str.length - 1; i >= 0; i--) {
    if (str[i] === '\n') count++;
    else if (ignoreWhiteSpaces && (str[i] === ' ' || str[i] === '\t' || str[i] === '\r')) continue;
    else break;
  }
  return count;
}

// 判断字符串是否全为空白字符（包括空格、制表符、换行符等）
// 空字符串也视为全空白
export function isWhitespace(str: string): boolean {
  if (str == null || str.length == 0) return true;
  return !/\S/.test(str);
}

// 截断字符串尾部，并转换为安全的单行显示形式
export function truncateToOneLine(str: string, maxLength = 80): string {
  const truncated = truncateTail(str, maxLength);
  return escapeNewlines(truncated);
}

// 把字符串用反引号包裹，在Markdown里显示时会高亮，看的清楚一些
export function code(str: string): string {
  return `\`${str}\``;
}

// 去掉内容前后的代码块标记(整行) (如果有的话)，以及前后的空白字符。
// 支持 ```lang/```/````开头，及 ```/````结尾
export function removeFencedCodeBlockMarker(str: string): string {
  if (str.startsWith('```')) {
    const firstNewline = str.indexOf('\n');
    if (firstNewline !== -1)
      str = str.slice(firstNewline + 1);
  }
  if (str.endsWith('````'))
    str = str.slice(0, -4);
  else if (str.endsWith('```'))
    str = str.slice(0, -3);
  return str.trim();
}

// JSON.stringify 的增强版本，支持排除指定字段，及格式化缩进
export function jsonToString(obj: any, excludedFields?: string[], space?: number): string {
  const replacer = excludedFields ? (key: string, value: any) => {
    if (excludedFields.includes(key))
      return undefined;
    return value;
  } : undefined;

  return JSON.stringify(obj, replacer, space);
}

// 根据文件路径里的后缀名，返回基本的 MIME 类型
export function getMimeTypeByFilePath(fullPath: string): string {
  const extname = path.extname(fullPath).toLowerCase();
  let mime_type = 'text/plain';
  if (extname === '.txt') mime_type = 'text/plain';
  else if (extname === '.json') mime_type = 'application/json';
  else if (extname === '.md') mime_type = 'text/markdown';
  else if (extname === '.html') mime_type = 'text/html';
  else if (extname === '.xml') mime_type = 'application/xml';
  else if (extname === '.yaml' || extname === '.yml') mime_type = 'application/x-yaml';
  else if (extname === '.csv') mime_type = 'text/csv';
  else if (extname === '.tsv') mime_type = 'text/tab-separated-values';
  else if (extname === '.pdf') mime_type = 'application/pdf';
  else if (extname === '.doc' || extname === '.docx') mime_type = 'application/msword';
  else if (extname === '.xls' || extname === '.xlsx') mime_type = 'application/vnd.ms-excel';
  else if (extname === '.ppt' || extname === '.pptx') mime_type = 'application/vnd.ms-powerpoint';
  else if (extname === '.jpg' || extname === '.jpeg') mime_type = 'image/jpeg';
  else if (extname === '.png') mime_type = 'image/png';
  else if (extname === '.gif') mime_type = 'image/gif';
  else if (extname === '.svg') mime_type = 'image/svg+xml';
  else if (extname === '.mp4') mime_type = 'video/mp4';
  else if (extname === '.mp3') mime_type = 'audio/mpeg';
  else if (extname === '.zip') mime_type = 'application/zip';
  else if (extname === '.rar') mime_type = 'application/x-rar-compressed';
  else if (extname === '.7z') mime_type = 'application/x-7z-compressed';
  return mime_type;
}

