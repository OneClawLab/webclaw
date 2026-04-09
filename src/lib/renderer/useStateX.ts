import { Logger } from '@lib/logast.js';
import * as React from 'react';
import { getComponentNameFromStack, shallowCompare } from '@lib/utils.js';

type SetState<S> = React.Dispatch<React.SetStateAction<S>>;
type Callback<S> = (prev: S) => S;

// useStateX: 带有变更日志打印的 useState 版本
export function useStateX<S>(initialValue: S): [S, SetState<S>] {
  const componentName = getComponentNameFromStack();
  const [state, setState] = React.useState<S>(initialValue);
  const prevRef = React.useRef<S>(state);

  const setStateX: SetState<S> = React.useCallback((valueOrUpdater: S | Callback<S>) => {
    setState(prev => {
      const next = typeof valueOrUpdater === 'function' ? (valueOrUpdater as Callback<S>)(prev) : valueOrUpdater;

      const changed = shallowCompare(prev, next);
      if (changed.length)
        Logger.debug(`[useStateX] Component: ${componentName} state changed: ${changed.join(', ')}`);

      prevRef.current = next;
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [state, setStateX];
}
