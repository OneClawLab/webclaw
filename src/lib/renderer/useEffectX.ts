import { Logger } from '@lib/logast.js';
import * as React from 'react';
import { getComponentNameFromStack, shallowCompare } from '@lib/utils.js';

type Callback = () => void | (() => void);

// 自动包装对象/数组，捕获属性访问
function wrapDep(dep: any, path: string[] = []): any {
  if (!dep || typeof dep !== 'object') return dep;
  return new Proxy(dep, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof prop === 'string') {
        if (!target.__accessed) target.__accessed = new Set<string>();
        target.__accessed.add([...path, prop].join('.'));
      }
      return wrapDep(value, [...path, String(prop)]);
    }
  });
}

// 存储每个callback对应的上一次deps快照
const callbackToDepsMap = new WeakMap<Callback, readonly unknown[]>();

// 类似 useEffect，但能追踪对象/数组属性变化，并打印变化原因
export function useEffectX(callback: Callback, deps: readonly unknown[]) {
  const componentName = getComponentNameFromStack();
  const wrappedDeps = deps.map(d => wrapDep(d));
  const prevDeps = wrappedDeps.map(d => (typeof d === 'object' && d !== null ? { ...d } : d));

  React.useEffect(() => {
    if (callbackToDepsMap.has(callback)) {
      const prev = callbackToDepsMap.get(callback)!;
      const changed: string[] = [];
      wrappedDeps.forEach((dep, i) => {
        if (typeof dep === 'object' && dep !== null) {
          changed.push(...shallowCompare(prev[i], dep));
        } else if (dep !== prev[i]) {
          changed.push(`dep[${i}]`);
        }
      });

      if (changed.length)
        Logger.debug(`[useEffectX] Component: ${componentName} triggered because: ${changed.join(', ')}`);
    }
    callbackToDepsMap.set(callback, prevDeps);

    return callback();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
