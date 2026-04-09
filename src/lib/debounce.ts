// loadash debounce equivalent

/**
 * Creates a debounced function that delays invoking `func` until after `wait` milliseconds
 * have elapsed since the last time the debounced function was called. 
 * Optionally, you can control whether `func` is invoked on the leading and/or trailing edge of the wait timeout,
 * and specify a maximum wait time (`maxWait`) to guarantee invocation.
 *
 * @template T - The type of the original function to debounce.
 * @param func - The function to debounce.
 * @param wait - The number of milliseconds to delay (default: 0).
 * @param options - Optional configuration object:
 *   - leading: If true, invoke on the leading edge of the timeout (default: false).
 *   - trailing: If true, invoke on the trailing edge of the timeout (default: true).
 *   - maxWait: The maximum time `func` is allowed to be delayed before it's invoked.
 * @returns A debounced version of `func` with the following methods:
 *   - cancel(): Cancels any pending invocation.
 *   - flush(): Immediately invokes any pending invocation.
 *   - pending(): Returns true if there is a pending invocation.
 *
 * @example
 * const debounced = debounce(() => console.log('Hello'), 200);
 * debounced();
 * debounced();
 * // 'Hello' will be logged only once, 200ms after the last call.
 */

export interface DebouncedFunc<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): void;
  cancel: () => void;
  flush: () => ReturnType<T> | undefined;
  pending: () => boolean;
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait = 0,
  options: {
    leading?: boolean;
    trailing?: boolean;
    maxWait?: number;
  } = {}
): DebouncedFunc<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let maxTimer: ReturnType<typeof setTimeout> | null = null;
  let lastCallTime: number | null = null;
  let lastInvokeTime = 0;
  let lastArgs: any[] | null = null;
  let lastThis: any = null;
  let result: ReturnType<T> | undefined;

  const { leading = false, trailing = true, maxWait } = options;

  const now = () => Date.now();

  function invoke() {
    lastInvokeTime = now();
    result = func.apply(lastThis, lastArgs!);
    lastArgs = lastThis = null;
    return result;
  }

  function startTimer() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(timerExpired, wait);
  }

  function startMaxTimer() {
    if (maxWait !== undefined && !maxTimer) {
      const timeSinceLastInvoke = now() - lastInvokeTime;
      const timeLeft = maxWait - timeSinceLastInvoke;
      if (timeLeft <= 0) {
        timerExpired();
      } else {
        maxTimer = setTimeout(timerExpired, timeLeft);
      }
    }
  }

  function timerExpired() {
    const timeSinceLastCall = now() - (lastCallTime ?? 0);

    if (timeSinceLastCall < wait && timeSinceLastCall >= 0) {
      // Wait not met yet, restart timer
      startTimer();
    } else {
      if (trailing && lastArgs) {
        invoke();
      }
      clearTimers();
    }
  }

  function clearTimers() {
    if (timer) clearTimeout(timer);
    if (maxTimer) clearTimeout(maxTimer);
    timer = null;
    maxTimer = null;
  }

  function debounced(this: any, ...args: any[]) {
    const time = now();
    const isInvoking = shouldInvoke(time);

    lastArgs = args;
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    lastThis = this;
    lastCallTime = time;

    if (isInvoking) {
      if (timer === null && leading) {
        result = invoke();
      }
      startTimer();
      startMaxTimer();
    } else {
      if (timer === null) {
        startTimer();
        startMaxTimer();
      }
    }
    return result;
  }

  function shouldInvoke(time: number) {
    const timeSinceLastCall = time - (lastCallTime ?? 0);
    const timeSinceLastInvoke = time - lastInvokeTime;

    return (
      lastCallTime === null ||
      timeSinceLastCall >= wait ||
      timeSinceLastCall < 0 ||
      (maxWait !== undefined && timeSinceLastInvoke >= maxWait)
    );
  }

  debounced.cancel = () => {
    clearTimers();
    lastArgs = lastThis = null;
    lastCallTime = null;
  };

  debounced.flush = () => {
    if (!timer) return result;
    if (lastArgs) {
      return invoke();
    }
    return result;
  };

  debounced.pending = () => {
    return !!timer;
  };

  return debounced;
}

type options = {
  leading?: boolean;
  trailing?: boolean;
  maxWait?: number;
}

export type DebounceStrategyParams = [ number, options ];

// 后台静默保存：用户停止操作后保存，最多 30s 强制保存一次
export const DEBOUNCE_SILENT_SAVE: [number, options] = [
  1000,
  {
    leading: false,
    trailing: true,
    maxWait: 30000,
  },
]

// 设置 dirty 状态为TRUE: 快速响应，首尾都触发
export const DEBOUNCE_DIRTY_TRUE: [number, options] = [
  300,
  {
    leading: true,
    trailing: true,
  },
]

// 设置界面 dirty 状态为FALSE: 延迟触发
export const DEBOUNCE_DIRTY_FALSE: [number, options] = [
  500,
  {
    leading: false,
    trailing: true,
  },
]

// 输入联想提示：用户输入停止后触发，最长等待 5 秒
export const DEBOUNCE_INPUT_SEARCH: [number, options] = [
  400,
  {
    leading: false,
    trailing: true,
    maxWait: 5000,
  },
]

// UI 事件：如 resize、滚动，仅触发最后一次
export const DEBOUNCE_TRAILING_ONLY: [number, options] = [
  200,
  {
    leading: false,
    trailing: true,
  },
]

// 只触发第一次：用于首击触发型事件
export const DEBOUNCE_LEADING_ONLY: [number, options] = [
  500,
  {
    leading: true,
    trailing: false,
  },
]

// 重试保护：适用于带 retry 的场景（首尾都触发，限制最大等待时间）
export const DEBOUNCE_RETRY_ACTION: [number, options] = [
  1000,
  {
    leading: true,
    trailing: true,
    maxWait: 10000,
  },
]

// 文档协作的编辑器变更同步：
export const DEBOUNCE_EDITOR_COLLAB: [number, options] = [
  1000,
  {
    leading: true,
    trailing: true,
    maxWait: 10000,
  },
]
