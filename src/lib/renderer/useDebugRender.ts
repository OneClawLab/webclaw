import { useRef, useEffect } from 'react';
import { Logger } from '@lib/logast.js';

// 用于调试组件渲染的 Hook
export function useDebugRender<TProps>(
  name: string,
  props: TProps
) {
  const lastProps = useRef<TProps | null>(null);

  useEffect(() => {
    if (lastProps.current) {
      // Ensure both are objects before using Object.keys
      const prevObj = (typeof lastProps.current === 'object' && lastProps.current !== null) ? lastProps.current : {};
      const nextObj = (typeof props === 'object' && props !== null) ? props : {};

      const changes: Record<string, { prev: any; next: any }> = {};
      const keys = new Set([...Object.keys(prevObj), ...Object.keys(nextObj)]);

      keys.forEach((key) => {
        const prev = (prevObj as any)[key];
        const next = (nextObj as any)[key];
        if (prev !== next) {
          changes[key] = { prev, next };
        }
      });

      if (Object.keys(changes).length > 0)
        Logger.debug('@'+ name, 'Rendering - Props Changed', changes.toString());
      else
        Logger.debug('@' + name, 'Rendering - Other');
    } else {
      Logger.debug('@' + name, 'Rendering - Initial');
    }

    lastProps.current = props;
  });
}
