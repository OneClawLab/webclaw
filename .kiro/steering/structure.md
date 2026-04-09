---
inclusion: always
---

# Project Structure

## 目录组织

### 进程划分
- **`src/node/`**: Main 进程（Electron 后端）
- **`src/renderer/`**: Renderer 进程（React 前端）
- **`src/lib/`**: Main/Renderer 共享代码

### 核心模块

#### `/src/node/xgw/` — xgw 通信层（Main 进程）
- `client.ts`: XgwClient（WebSocket 客户端，连接管理、心跳、重连、离线队列）
- `bridge.ts`: IPC handlers（转接 renderer 请求到 XgwClient）

#### `/src/node/utils/` — Main 进程工具
- `fsWatcher.ts`: 文件系统监听（知识库目录变更检测）

#### `/src/lib/webui-protocol/` — WebUI 帧协议（共享）
- `types.ts`: 帧类型定义（ClientFrame / ServerFrame）
- `parser.ts`: 解析器 / 序列化器
- `index.ts`: 模块入口

#### `/src/ai/common/` — Slash Command / @ Reference 共享代码
- `Prompt.ts`: 用户输入解析、Slash 命令展开、@kb 路径展开
- `SlashCommands.ts`: Slash 命令加载与管理

#### `/src/editor/` — CodeMirror 编辑器（Renderer）
- `extensions/`: CM 扩展（links、checklist、table、image 等）
- `commands/`: 编辑器命令（含 AI 交互 doAskAI）

#### `/src/state/slices/` — Redux 状态（Renderer）
- `connection/`: xgw 连接状态（status/host/port/channelId/peerId）
- `agent/`: Agent 列表（availableAgents/defaultAgentId）
- `doc/`: 文档（含 conversationId/agentId/agentLocked）
- `tab/`, `tree/`, `workspace/`, `settings/`, `ui/`, `lib/`, `runtime/`, `dialog/`, `user/`

#### `/src/renderer/` — UI 组件（Renderer）
- `views/ThreadBrowser.tsx`: Thread 浏览器
- `components/AgentSelector.tsx`: Agent 选择组件
- `components/StatusBar.tsx`: 状态栏（含 xgw 连接状态）
- `modals/ConnectionSettings.tsx`: 连接设置
- `client/ai.ts`: AI 客户端（通过 window.xgw 通信）

### 支撑模块

- **`/src/commands/`**: 全局命令系统
- **`/src/event/`**: 事件总线
- **`/src/hotkeys/`**: 快捷键
- **`/src/library/`**: 知识库系统（LibraryFactory / LibraryStore）
- **`/src/view/`**: 视图管理

### 资源与配置

- **`/src/types/`**: 全局类型定义（含 window.xgw / window.fsWatch 声明）
- **`/assets/`**: 应用图标
- **`/kb/system/`**: 系统知识库（slash-commands 等）

## 路径别名

```typescript
@ai/*        → src/ai/*
@node/*      → src/node/*
@renderer/*  → src/renderer/*
@state/*     → src/state/*
@editor/*    → src/editor/*
@lib/*       → src/lib/*
@/*          → src/*
```

## 架构模式

- **进程分离**: Main（Node.js）/ Renderer（浏览器）严格分离
- **IPC 桥接**: Main ↔ Renderer 通过 Electron IPC + contextBridge
- **Redux**: 集中式状态管理
- **Command**: 可扩展命令注册系统
- **WebSocket 通信**: Main 进程维护 xgw 连接，通过 IPC 转发帧给 Renderer
- **知识库驱动配置**: Slash 命令等通过 kb/system/ 下的 Markdown 文件定义
