import { nanoid } from "nanoid";

////////////////////////////////////////////

export function uniqueid(size: number): string {
  return nanoid(size);
}

////////////////////////////////////////////

const __idMap = new WeakMap<object, string>()
let __idCounter = 1

// 工具函数：给任意对象分配一个稳定的唯一 ID
// 对于同一个对象，多次调用返回相同的 ID
// ID 仅在 当前运行时有效，程序重启后会重新分配 ID
export function getStableId(obj: any): string {
  if (obj === null)
    return 'null';
  if (obj === undefined)
    return 'undefined';
  if (typeof obj !== 'object' && typeof obj !== 'function')
    return 'unknown';

  if (!__idMap.has(obj)) {
    const id = (typeof obj) + '.' + __idCounter++;
    __idMap.set(obj, id);
    return id;
  }

  return __idMap.get(obj)!
}

////////////////////////////////////////////

// 返回一个全局唯一的单调递增 ID
export function getNextId(): string;
// 返回一个指定命名空间内的单调递增 ID
export function getNextId(namespace: string): string;
// 返回一个指定命名空间内、带有前缀的单调递增 ID
export function getNextId(namespace: string, prefix: string): string;

// monotonically increasing ID generator
// 每次调用返回一个新的 ID，ID 在同一命名空间内单调递增
export function getNextId(namespace?: string, prefix?: string): string {
  if (namespace === undefined) namespace = '';

  if (!(getNextId as any).__counters)
    (getNextId as any).__counters = new Map<string, number>();

  const counters: Map<string, number> = (getNextId as any).__counters;
  let count = counters.get(namespace) || 0;
  count++;
  counters.set(namespace, count);

  if (prefix)
    return `${prefix}${count}`;
  else
    return `${count}`;
}
