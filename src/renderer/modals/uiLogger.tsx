// 用法：最简单的
//  window.uilog("Some log text");
// 
// 高级功能：
//  const { appendText, toggle, show, hide, clear, visible } = useLogView();
// 其中：
//  appendText("New log entry");
//  clear(); // 清空日志
//  toggle(); // 切换可见性
//  visible; // 当前是否可见
//  日志窗口会在有新日志时自动弹出，除非关闭了自动弹出功能。

import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import { useTranslation } from '@lib/renderer/useTranslation.js'

type LogViewContextType = {
  log: (text: string) => void;
  toggle: (visible?: boolean) => void;
  clear: () => void;
  visible: boolean;
};

const LogViewContext = createContext<LogViewContextType | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export const useLogView = () => {
  const { t } = useTranslation();
  const ctx = useContext(LogViewContext);
  if (!ctx) throw new Error(t('errors.context.logViewProviderNotFound'));
  return ctx;
};

export const LogViewProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [autoVisible, setAutoVisible] = useState(true); // 自动弹出开关
  const [height, setHeight] = useState(400);            // 日志窗口高度
  const logRef = useRef<HTMLDivElement>(null);

  const log = useCallback((text: string) => {
    setLogs((prev) => [...prev, text]);
    if (text && autoVisible && !visible)
      setVisible(true); // 自动弹出
  }, [visible, autoVisible]);

  const clear = useCallback(() => setLogs([]), []);

  const toggle = (visible?: boolean) => {
    if (typeof visible === "boolean")
      setVisible(visible);
    else
      setVisible(v => !v);
  };

  // 工具条功能
  const copyAll = useCallback(() => {
    navigator.clipboard.writeText(logs.join("\n"));
  }, [logs]);

  const toggleAutoVisible = useCallback(() => {
    setAutoVisible(v => !v);
  }, []);

  const increaseHeight = useCallback(() => {
    setHeight(h => {
      if (h < 400) return 400;
      if (h < 600) return 600;
      return 600;
    });
  }, []);

  const decreaseHeight = useCallback(() => {
    setHeight(h => {
      if (h > 400) return 400;
      if (h > 200) return 200;
      return 200;
    });
  }, []);

  // ESC关闭 + Mod+X清空
  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") toggle(false);
      if (e.ctrlKey && e.key.toLowerCase() === "x") {
        clear();
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [visible, clear]);

  // 点击外部关闭
  useEffect(() => {
    if (!visible) return;
    const onMouseDown = (e: MouseEvent) => {
      if (logRef.current && !logRef.current.contains(e.target as Node))
        toggle(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [visible]);

  useEffect(() => {
    (window as any).uilog = log;
  }, [log, clear]);

  return (
    <LogViewContext.Provider value={{ log, toggle, clear, visible }}>
      {children}
      <div
        ref={logRef}
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "#111",
          color: "#Bf0",
          padding: visible ? "1em" : "0",
          fontSize: "0.8em",
          height: visible ? `${height}px` : "0px",
          transition: "height 0.3s ease, padding 0.3s ease",
          pointerEvents: visible ? "auto" : "none",
          userSelect: "text",
          display: visible ? "flex" : "none",
          flexDirection: "column",
        }}
        tabIndex={-1}
      >
        {/* 工具条 */}
        <div
          style={{
            display: "flex",
            gap: "0.5em",
            alignItems: "center",
            background: "#111",
            paddingBottom: "0.5em",
            zIndex: 2,
            flex: "none",
          }}
        >
          <style>
            {`
              .log-btn {
                padding: 0.3em 1em;
                border-radius: 4px;
                border: 1px solid #Bf0;
                background: #222;
                color: #Bf0;
                cursor: pointer;
                font-weight: bold;
                box-shadow: 0 1px 2px #0004;
                transition: background 0.1s;
              }
              .log-btn:active {
                background: #3f3;
                color: #222;
              }
              .log-btn.auto-on {
                background: #262;
              }
            `}
          </style>
          <button className="log-btn" onClick={copyAll}>Copy All</button>
          <button className="log-btn" onClick={clear}>Clear All</button>
          <button
            className={`log-btn${autoVisible ? " auto-on" : ""}`}
            onClick={toggleAutoVisible}
          >
            AutoVisible: {autoVisible ? "On" : "Off"}
          </button>
          <button className="log-btn" onClick={increaseHeight}>Increase Height</button>
          <button className="log-btn" onClick={decreaseHeight}>Decrease Height</button>
        </div>
        {/* 内容区 */}
        <div
          style={{
            flex: 1,
            overflow: "auto",
          }}
        >
          <pre
            tabIndex={0}
            style={{
              outline: "2px dashed black",
              whiteSpace: "pre-wrap",
              userSelect: "text",
              margin: 0,
            }}
          >
            {logs.join("\n")}
          </pre>
        </div>
      </div>
    </LogViewContext.Provider>
  );
};
