---
inclusion: always
---

# Product Overview

**WebClaw** — TheClaw 桌面客户端

WebClaw 是基于 Eidux 改造的 TheClaw agent 运行时系统的全功能桌面客户端。所有 AI 能力由 TheClaw 的 xar + xgw + pai 提供，WebClaw 本身不内置任何 LLM/RAG/向量数据库。

## 核心理念

### "文档即聊天，聊天即文档"
- 每个文档对应一个 Conversation（通过 frontmatter 中的 conversation_id 关联）
- 聊天内容以 Markdown 格式存储，用户可随时编辑加工
- 文档是用户侧主存储，TheClaw 的 thread 是 agent 侧独立记录

### "文档即功能，功能即文档"
- Slash 命令通过 kb/system/slash-commands/ 下的 Markdown 文件定义
- 用户可自行扩展命令和提示词模板

## 核心组件

### Markdown 编辑器（CodeMirror 6）
- 所见即所得，支持完整 Markdown 语法
- 50+ 编程语言语法高亮
- 光标进入区块切换编辑模式

### 知识库管理
- 管理本机多个知识库（本地目录）
- 文件树浏览，文件系统监听（自动检测外部变更）
- @kb/ 引用语法，发送时展开为 POSIX 绝对路径

### xgw 通信
- 通过 WebSocket 连接 xgw WebUI Plugin（默认 127.0.0.1:29212）
- 单连接多会话复用（conversation_id 路由）
- 流式响应（stream_chunk/stream_end）、进度事件（thinking/tool_call 等）
- 指数退避重连、心跳保活、离线消息队列

### Agent 选择
- 从 xgw hello_ack 获取可用 agent 列表
- per-document 绑定，首次发消息后锁定（TheClaw thread 归属模型）
- 默认 agent: admin

### Thread 浏览器
- 浏览 ~/.theclaw/agents/ 下所有 agent 的 thread 历史
- 按 agent 筛选，只读查看 events.jsonl

## 设计原则

- **Local-First**: 文档和知识库存储在本地，不依赖云服务
- **TheClaw 原生**: 所有 AI 能力通过 xgw/xar/pai 提供，不内置 LLM
- **跨平台**: Windows / macOS (Intel + Apple Silicon) / Linux
- **可扩展**: 通过 Markdown 文件自定义 Slash 命令和知识库内容

## 目标用户

- TheClaw 用户：需要富客户端交互（相比 TUI）
- 知识工作者：文档编辑 + AI 辅助
- 开发者：技术文档管理 + agent 交互
