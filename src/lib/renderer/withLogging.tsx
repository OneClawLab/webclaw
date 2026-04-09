import { useEffect } from "react";
import { Logger } from "@lib/logast.js";

const WITH_LOGGING_ENABLED = false;

interface LoggingOptions {
  name: string;
  onRender?: boolean;
  onMount?: boolean;
  onUnmount?: boolean;
}

// 为组件添加生命周期日志打印功能
// 打印的日志受全局开关 WITH_LOGGING_ENABLED 控制，以及各个组件的特定选项控制
export function withLogging<TProps>(
  Component: React.ComponentType<TProps>,
  options: LoggingOptions
): React.FC<React.PropsWithChildren<TProps>> {
  const {
    name,
    onRender = true,
    onMount = true,
    onUnmount = true
  } = options;

  // 如果全局开关为关闭，或者所有日志选项都为 false，则直接返回原始组件
  if (!WITH_LOGGING_ENABLED || (!onRender && !onMount && !onUnmount)) {
    Component.displayName = Component.displayName || name; // React DevTools 需要此 displayName
    return Component as React.FC<React.PropsWithChildren<TProps>>;
  }

  const Wrapped: React.FC<React.PropsWithChildren<TProps>> = (props) => {
    if (onRender)
      Logger.debug('@' + name, 'Rendering');

    useEffect(() => {
      if (onMount) Logger.debug('@' + name, 'Mounted');
      return () => { if (onUnmount) Logger.debug('@' + name, 'Unmounted'); }
    }, []);

    return <Component {...props} />;
  };

  Wrapped.displayName = `WithLifecycleLogger(${name})`;
  return Wrapped;
}
