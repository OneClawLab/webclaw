# WebClaw

> **TheClaw 桌面客户端**

WebClaw 是基于 Eidux 改造的 [TheClaw](https://github.com/user/theclaw) agent 运行时系统的全功能桌面客户端。通过 WebSocket 连接 xgw 通信网关，与 TheClaw 的多 agent 体系交互。保留了 Eidux 的 Markdown 编辑器、知识库管理等核心前端能力，所有 AI 能力由 TheClaw 的 xar + xgw + pai 提供。

---

## 功能概览

| 功能 | 说明 |
|------|------|
| Markdown 编辑器 | 所见即所得，基于 CodeMirror 6，支持完整 Markdown 语法 |
| 知识库管理 | 管理本机多个知识库（本地目录），支持文件树浏览和文件系统监听 |
| Agent 交互 | 通过 xgw WebUI Plugin 与 TheClaw agent 实时对话，支持流式响应 |
| 多会话 | 单 WebSocket 连接复用多个 Conversation，每个文档对应一个会话 |
| Agent 选择 | 从 TheClaw 获取可用 agent 列表，per-document 绑定 |
| Thread 浏览器 | 浏览 `~/.theclaw/agents/` 下所有 agent 的 thread 历史 |
| Slash 命令 | 编辑器内 `/命令` 快速调用提示词模板 |
| @ 引用 | 在消息中 `@kb/...` 引用知识库文件，发送时展开为绝对路径 |
| 自动更新 | 内置 electron-updater，支持跨平台自动更新 |
| 多平台 | Windows、macOS（Intel / Apple Silicon）、Linux |

---

## 架构

```
WebClaw (Electron)                    TheClaw (同机部署)
┌─────────────────────┐               ┌──────────────┐
│  Renderer Process   │               │  xgw daemon   │
│  React + Redux      │               │  WebUI Plugin │
│  CodeMirror Editor  │               │  :28211       │
│  window.xgw (IPC)  │               └──────┬───────┘
└────────┬────────────┘                      │ IPC
         │ Electron IPC                      │
┌────────┴────────────┐               ┌──────┴───────┐
│  Main Process       │──WebSocket──▶ │  xar daemon   │
│  XgwClient          │               │  Agent Runtime│
│  Frame Parser       │               └──────────────┘
└─────────────────────┘
```

**核心通信协议：** WebUI 帧协议（JSON over WebSocket），支持 hello/hello_ack 握手、open/close_conversation 会话管理、message/stream_chunk/stream_end 消息流、progress 进度事件、ping/pong 心跳。

---

## 技术栈

**应用框架**
- Electron v39 + electron-vite v5 + electron-builder v26

**前端（Renderer 进程）**
- React v19 + Redux Toolkit v2
- CodeMirror v6
- Tailwind CSS v4 + Radix UI
- Lucide React

**通信层（Main 进程）**
- ws — WebSocket 客户端，连接 xgw WebUI Plugin
- 自定义帧协议解析/序列化（`src/lib/webui-protocol/`）
- Electron IPC 桥接（`src/node/xgw/`）

---

## 项目结构

```
webclaw/                        # 
├── src/
│   ├── node/                   # Main / Preload 进程
│   │   ├── main.ts             # 应用入口
│   │   ├── preload.ts          # Preload 脚本（暴露 xgw/fsWatch API）
│   │   ├── ipc.ts              # IPC 注册
│   │   ├── bridge/             # Main ↔ Renderer 桥接
│   │   ├── xgw/               # xgw 通信层
│   │   │   ├── client.ts       # XgwClient（WebSocket 客户端）
│   │   │   └── bridge.ts       # IPC handlers
│   │   └── utils/
│   │       └── fsWatcher.ts    # 文件系统监听
│   ├── lib/
│   │   └── webui-protocol/     # WebUI 帧协议（Main/Renderer 共享）
│   │       ├── types.ts        # 帧类型定义
│   │       ├── parser.ts       # 解析器/序列化器
│   │       └── index.ts
│   ├── ai/common/              # Slash Command / @ Reference 共享代码
│   ├── renderer/               # 前端界面
│   │   ├── views/              # 主要视图（含 ThreadBrowser）
│   │   ├── components/         # 通用组件（含 AgentSelector）
│   │   ├── modals/             # 对话框（含 ConnectionSettings）
│   │   └── client/ai.ts        # AI 客户端（通过 window.xgw 通信）
│   ├── state/slices/           # Redux 状态
│   │   ├── connection/         # xgw 连接状态
│   │   ├── agent/              # Agent 列表
│   │   ├── doc/                # 文档（含 conversationId/agentId）
│   │   └── ...                 # tab/tree/workspace/settings/ui 等
│   ├── editor/                 # CodeMirror 编辑器扩展
│   ├── commands/               # 全局命令
│   ├── library/                # 知识库模块
│   └── types/                  # 全局类型定义
├── kb/system/                  # 系统知识库（slash-commands 等）
├── assets/                     # 应用图标
└── electron-builder.config.mjs
```

---

## 快速开始

### 前置条件

- Node.js >= 22
- TheClaw 已部署并运行（xgw daemon 监听 127.0.0.1:28211）

### 安装

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 构建

```bash
npm run build           # 开发构建
npm run build:release   # 发布构建
```

### 打包

```bash
npm run release:win     # Windows
npm run release:mac     # macOS
npm run release:linux   # Linux
```

---

## 连接配置

WebClaw 默认连接 `127.0.0.1:28211`（xgw WebUI Plugin 端口）。

可通过状态栏的连接图标打开设置面板，配置：
- Host / Port
- Channel ID（默认 `webui:default`）
- Peer ID（默认 `owner`）

配置保存后自动重连。

---

## 文档与会话

每个文档对应一个 Conversation：
- 新建文档时自动生成 `conversation_id`（nanoid），默认绑定 `admin` agent
- 发送第一条消息后 agent 绑定锁定（TheClaw 的 thread 归属模型）
- 文档的 `.md` 文件是用户侧主存储，TheClaw 的 thread 是 agent 侧独立记录

在编辑器中按 `Mod+Enter` 发送消息，agent 的流式响应实时追加到文档中。

---

## Slash 命令

输入 `/` 触发命令菜单。内置命令包括 `/why`、`/explain`、`/summarize`、`/refine`、`/translate` 等。

扩展方式：在 `kb/system/slash-commands/` 目录下添加 Markdown 文件。

---

## @ 引用

在消息中输入 `@kb/...` 引用知识库文件。发送时自动展开为 POSIX 绝对路径，因为 TheClaw 的 agent 不感知知识库概念，只认文件系统路径。

---

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Mod+Enter` | 发送消息 / 触发 AI 对话 |
| `Mod+N` | 新建文档 |
| `Mod+S` | 保存文档 |
| `Mod+W` | 关闭标签页 |
| `Mod+Tab` | 切换标签页 |
| `Mod+=` / `Mod+-` | 展开/折叠内容层级 |
| `Mod+B/I/U` | 粗体/斜体/下划线 |

---

## License

MIT
