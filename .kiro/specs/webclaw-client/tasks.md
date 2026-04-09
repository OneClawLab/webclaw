# 实施计划：Webclaw Client

## 概述

将 Eidux 桌面应用改造为 TheClaw agent 运行时系统的桌面客户端 WebClaw。按照依赖关系分阶段推进：先清理代码建立干净基线，再实现共享协议模块，然后逐层构建 WebSocket 客户端、IPC 桥接、Renderer 端功能，最后完成集成测试。

## 任务

- [x] 1. 代码库清理与依赖整理
  - [x] 1.1 移除 AI 服务层和后端代码
    - 删除 `src/ai/node/` 整个目录（agent、llm、rag、tools、skill、server、reference、misc、context 模块）
    - 删除 `src/http/` 目录下的 AI HTTP 服务器代码（Fastify AI server）
    - 删除 `backend/` 整个目录（llm-proxy、mock-llm-service、supabase、website）
    - 删除 `lancedb_natives/` 整个目录
    - 删除 `kb/system/skills/` 和 `kb/system/prompts/` 目录
    - 删除 `.github/` 目录中 Eidux 特有的 CI/CD 配置和 copilot-instructions.md
    - 保留 `src/ai/common/` 中与 Slash Command 和 @ Reference 相关的共享代码
    - _需求: 1.1, 1.2, 1.3, 1.4, 1.5, 1.9, 1.11_

  - [x] 1.2 移除 AI 相关初始化逻辑和配置
    - 移除 Node.js 初始化中的 LanceDB、LlamaIndex、Fastify AI server 初始化代码
    - 移除 `.env.example` 和 `.env` 中的 LLM API key 配置项
    - 移除 electron-builder 配置中 asarUnpack 的 `@lancedb` 和 `apache-arrow` 条目
    - 移除 Supabase 相关代码和依赖引用
    - _需求: 1.6, 1.7, 1.8, 1.10_

  - [x] 1.3 清理依赖（package.json）
    - 从 dependencies 移除：@ai-sdk/anthropic、@ai-sdk/google、@ai-sdk/openai、ai、@lancedb/lancedb、@llamaindex/core、llamaindex、@tavily/core、apache-arrow、fastify、@fastify/cors、stream-json、cheerio、@supabase/supabase-js、just-bash、triple-beam
    - 从 devDependencies 移除：@napi-rs/cli
    - 新增 `ws` 包和 `@types/ws`（WebSocket 客户端）
    - 保留所有 CodeMirror、React、Redux、Electron、Tailwind CSS 相关依赖
    - _需求: 16.1, 16.2, 16.3, 16.4_

  - [x] 1.4 修复悬空引用，确保清理后应用可构建
    - 排查所有对已删除模块的 import 引用并移除或替换
    - 移除 doc slice 中与 Eidux AI 模式相关的字段（mode 选择等）
    - 确保 `npm install` 成功且无 peer dependency 冲突
    - 确保 electron-vite 构建通过
    - _需求: 1.12, 15.4, 16.4_

- [ ] 2. 检查点 - 清理后基线验证
  - 确保所有构建通过，应用能正常启动，ask the user if questions arise.

- [x] 3. WebUI 帧协议模块（src/lib/webui-protocol/）
  - [x] 3.1 实现帧类型定义和解析器/序列化器
    - 在 `src/lib/webui-protocol/types.ts` 中定义所有 WebUI_Frame 类型（HelloFrame、HelloAckFrame、ErrorFrame、OpenConversationFrame、CloseConversationFrame、MessageFrame、StreamChunkFrame、StreamEndFrame、ProgressFrame、PingFrame、PongFrame）及联合类型 ClientFrame、ServerFrame、WebUIFrame
    - 在 `src/lib/webui-protocol/parser.ts` 中实现 `parseFrame(raw: string): ParseResult<ServerFrame>` 和 `serializeFrame(frame: ClientFrame): string`
    - 解析器校验 `type` 字段存在且为已知类型，校验各帧类型的必要字段
    - 非法 JSON 返回包含原始输入摘要的错误，缺少字段返回指明缺失字段名的错误
    - 导出 `src/lib/webui-protocol/index.ts` 作为模块入口
    - _需求: 3.1, 4.1, 4.2, 4.3, 4.4_

  - [ ]* 3.2 属性测试：帧协议 Round-Trip
    - **Property 1: 帧协议 Round-Trip**
    - 测试文件：`vitest/pbt/webui-frame.pbt.test.ts`
    - 使用 fast-check 生成所有 WebUIFrame 类型的随机实例，验证 serialize → parse 产生等价对象
    - **验证需求: 3.1, 3.6, 4.1, 4.4, 4.5**

  - [ ]* 3.3 属性测试：解析器拒绝非法输入
    - **Property 2: 解析器拒绝非法输入并返回描述性错误**
    - 测试文件：`vitest/pbt/webui-frame.pbt.test.ts`（同文件）
    - 使用 fast-check 生成随机非 JSON 字符串和缺少必要字段的 JSON 对象，验证返回描述性错误
    - **验证需求: 4.2, 4.3**

- [x] 4. XgwClient（Main Process WebSocket 客户端）
  - [x] 4.1 实现 XgwClient 核心连接管理
    - 在 `src/node/xgw/client.ts` 中实现 XgwClient 类（extends EventEmitter）
    - 实现 `connect()`、`disconnect()`、`sendMessage()`、`openConversation()`、`closeConversation()` 方法
    - 实现连接生命周期状态机：disconnected → connecting → connected → authenticated → reconnecting
    - 连接建立后发送 hello 帧，等待 hello_ack 响应后标记为 authenticated
    - _需求: 2.1, 2.2, 2.3_

  - [x] 4.2 实现指数退避重连和心跳机制
    - 指数退避策略：初始 1s，上限 60s，最多 10 次尝试
    - 心跳：每 30s 发送 ping 帧，收到 pong 更新 lastHeartbeat
    - 连续 3 次 ping 无 pong → 关闭连接触发重连
    - 重连成功后重新发送所有已打开 Document 的 open_conversation 帧
    - _需求: 2.4, 2.5, 2.6, 2.7_

  - [x] 4.3 实现离线消息队列
    - WebSocket 不可用时缓存消息到本地队列（最多 50 条）
    - 连接恢复后按原始顺序重发
    - 队列溢出时丢弃最早的消息并通知用户
    - _需求: 20.3_

  - [ ]* 4.4 属性测试：指数退避计算
    - **Property 4: 指数退避计算在合法范围内**
    - 测试文件：`vitest/pbt/backoff.pbt.test.ts`
    - 使用 fast-check 生成 1-10 范围的随机整数，验证退避时间 ≥1s、≤60s、单调不减
    - **验证需求: 2.4**

  - [ ]* 4.5 属性测试：入站帧路由
    - **Property 3: 入站帧按 conversation_id 正确路由**
    - 测试文件：`vitest/pbt/frame-routing.pbt.test.ts`
    - 使用 fast-check 生成随机 conversation_id 集合和帧，验证路由正确性
    - **验证需求: 3.5**

  - [ ]* 4.6 属性测试：离线消息队列保序
    - **Property 7: 离线消息队列保序**
    - 测试文件：`vitest/pbt/message-queue.pbt.test.ts`
    - 使用 fast-check 生成随机消息序列，验证重发顺序与原始顺序一致
    - **验证需求: 20.3**

  - [ ]* 4.7 单元测试：XgwClient
    - 测试文件：`vitest/unit/xgw-client.test.ts`
    - 测试握手流程、状态转换、心跳超时、重连逻辑、error 帧转发
    - _需求: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

- [ ] 5. 检查点 - 协议与客户端验证
  - 确保所有测试通过，ask the user if questions arise.

- [x] 6. Electron IPC 桥接层
  - [x] 6.1 实现 Main Process 端 IPC handlers
    - 在 `src/node/xgw/bridge.ts` 中实现 `registerXgwIpcHandlers(client: XgwClient)`
    - 注册 IPC 通道：`xgw:sendMessage`、`xgw:openConversation`、`xgw:closeConversation`、`xgw:getStatus`、`xgw:updateConfig`
    - 监听 XgwClient 事件，通过 `webContents.send` 推送帧和状态变更给 Renderer
    - _需求: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 6.2 扩展 Preload 暴露 xgw API
    - 在 `src/node/preload.ts` 中通过 `contextBridge.exposeInMainWorld('xgw', xgwAPI)` 暴露类型安全接口
    - 包含：sendMessage、openConversation、closeConversation、getStatus、updateConfig、onFrame、onStatusChange
    - Renderer 进程不直接访问 Node.js API
    - _需求: 5.6_

  - [x] 6.3 在 Main Process 入口初始化 XgwClient 和 IPC 桥接
    - 在 Electron main 入口中创建 XgwClient 实例（使用持久化配置或默认值）
    - 调用 `registerXgwIpcHandlers` 注册 IPC handlers
    - 在 app ready 后自动连接 xgw
    - _需求: 2.1, 5.1_

- [x] 7. Redux 状态扩展
  - [x] 7.1 新增 connection slice
    - 在 `src/state/slices/connection/` 中创建 connection slice
    - 管理状态：status、host、port、channelId、peerId、lastHeartbeat、reconnectAttempt、error
    - 默认值：host='127.0.0.1'、port=28211、channelId='webui:default'、peerId='owner'
    - _需求: 15.1, 10.3_

  - [x] 7.2 新增 agent slice
    - 在 `src/state/slices/agent/` 中创建 agent slice
    - 管理状态：availableAgents 列表、defaultAgentId（默认 'admin'）
    - hello_ack 帧到达时更新 availableAgents
    - _需求: 15.2, 9.2_

  - [x] 7.3 扩展 doc slice
    - 在 Doc 类型中新增 conversationId、agentId、agentLocked 字段
    - 新增 actions：setConversationId、setAgentId、lockAgent
    - 新增 streaming 状态管理（per-conversation 的 streaming/pendingTokens/progressKind）
    - _需求: 15.3, 15.5_

  - [ ]* 7.4 属性测试：连接配置 Round-Trip
    - **Property 5: 连接配置 Round-Trip**
    - 测试文件：`vitest/pbt/connection-config.pbt.test.ts`
    - 使用 fast-check 生成随机 host/port/channelId/peerId，验证保存到 storage 后加载产生等价对象
    - **验证需求: 10.2**

- [x] 8. Renderer 端适配：client/ai.ts 与消息发送
  - [x] 8.1 改造 client/ai.ts
    - 保留 `streamChat`、`aiStatus`、`listAgents` 方法签名
    - `streamChat` 底层从 HTTP fetch 替换为 `window.xgw.sendMessage()` + 监听 `onFrame` 事件
    - 帧类型到 writer 区域映射：stream_chunk→output、stream_end→finalize、progress→progress、error→progress(error)
    - `aiStatus` 改为从 Redux connection slice 读取
    - `listAgents` 改为从 Redux agent slice 读取
    - 移除不再需要的方法：saveChatMemory、deleteChatMemory、renameChatMemory、getChatMemory、isChatMemoryExists、getStaticChatMemory、setStaticChatMemory、setCustomAgentSystemPrompt、mountResources、unmountResources、resolveResourcePath、testAi
    - _需求: 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x] 8.2 适配 doAskAI 调用方
    - `agentName` 参数从 Eidux 模式（normal/advanced/skilled/custom/ems）改为 TheClaw agent_id
    - `sessionId = docId` 映射改为 `conversationId = docId`
    - 移除 custom agent prompt 提取逻辑
    - _需求: 8.7, 9.4_

  - [x] 8.3 实现 Document ↔ Conversation 映射
    - 创建新 Document 时生成 nanoid 作为 conversation_id，写入 frontmatter（`---\nconversation_id: xxx\nagent_id: admin\n---`）
    - 打开已有 Document 时从 frontmatter 读取 conversation_id，发送 open_conversation 帧
    - 无 frontmatter conversation_id 的文档视为普通文档
    - 用户消息作为 Markdown 标题块写入 Document，agent 响应作为 Markdown 内容追加
    - _需求: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9_

- [x] 9. Renderer 端 UI 组件
  - [x] 9.1 实现 Agent 选择组件
    - 创建 `src/renderer/components/AgentSelector.tsx`
    - 从 Redux agent slice 读取 available_agents，从 Document 元数据读取 agentId
    - 空文档：下拉菜单可切换 agent；有聊天历史：只读标签
    - 默认 agent: admin
    - 在编辑器工具栏中集成
    - _需求: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

  - [x] 9.2 实现连接设置组件
    - 创建 `src/renderer/modals/ConnectionSettings.tsx`
    - 表单：host、port、channel_id、peer_id
    - 保存到 Redux connection slice + window.storage 持久化
    - 保存时调用 `window.xgw.updateConfig()` 触发重连
    - 显示当前连接状态（未连接、连接中、已连接、重连中）
    - _需求: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 9.3 实现连接状态栏指示器
    - 在状态栏中显示 WebSocket 连接状态图标（绿色/黄色/红色）
    - 监听 Redux connection slice 变化，200ms 内更新
    - 断开且重连失败时显示通知
    - 断开状态下禁用消息发送并显示离线提示
    - 连接恢复时重新发送所有已打开 Document 的 open_conversation 帧
    - _需求: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [x] 9.4 实现进度事件可视化
    - thinking → 可折叠的"思考过程"Markdown 块
    - tool_call → "工具调用"Markdown 块（工具名称和参数摘要）
    - tool_result → "执行结果"Markdown 块（结果摘要）
    - ctx_usage → 状态栏显示 context window 使用百分比
    - compact_start → 状态栏显示"正在压缩会话..."
    - compact_end → 状态栏显示压缩前后 token 数量变化
    - _需求: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x] 9.5 实现错误处理与恢复 UI
    - error 帧在对应 Document 中以 Markdown 引用块格式显示
    - 流式传输中断时标记响应为"中断"状态并保留已接收内容
    - 断开连接不丢失已显示的聊天内容
    - _需求: 20.1, 20.2, 20.4_

- [ ] 10. 检查点 - Renderer 端功能验证
  - 确保所有测试通过，UI 组件正常渲染，ask the user if questions arise.

- [x] 11. Slash Command 与 @ Reference 适配
  - [x] 11.1 适配 Slash Command 系统
    - 保留所有现有 Slash_Command 定义（/why、/explain 等）
    - 触发时将 prompt 模板展开后的文本通过 message 帧发送给 xgw
    - Document 中只显示用户输入的原始 Slash_Command 文本（不展开）
    - 保留用户通过知识库 Markdown 文件自定义 Slash_Command 的能力
    - _需求: 18.1, 18.2, 18.3_

  - [x] 11.2 适配 @ Reference 机制
    - 保留 @ 触发的自动补全菜单和知识库路径补全
    - 发送消息前将 `@kb/...` 路径展开为 POSIX 格式的文件系统绝对路径
    - _需求: 19.1, 19.2, 19.3, 19.4_

  - [ ]* 11.3 属性测试：@kb 路径展开
    - **Property 6: @kb 路径展开为 POSIX 绝对路径**
    - 测试文件：`vitest/pbt/at-reference.pbt.test.ts`
    - 使用 fast-check 生成随机 POSIX 路径段，验证展开后为绝对路径且包含知识库根目录和相对路径
    - **验证需求: 19.4**

- [x] 12. Thread 浏览器
  - [x] 12.1 实现 Thread 浏览器组件
    - 创建 `src/renderer/views/ThreadBrowser.tsx`
    - 通过 window.fs 读取 `~/.theclaw/agents/` 目录，列出 agent → threads 树形结构
    - 显示每个 thread 的基本信息（创建时间、最后活动时间、事件数量）
    - 选择 thread 后读取 events.jsonl 渲染为只读 Markdown Document
    - 支持按 agent 筛选 thread 列表
    - `~/.theclaw/` 不存在时显示引导提示
    - _需求: 14.1, 14.2, 14.3, 14.4, 14.5_

  - [ ]* 12.2 属性测试：Thread 按 agent 筛选
    - **Property 8: Thread 按 agent 筛选正确性**
    - 测试文件：`vitest/pbt/thread-filter.pbt.test.ts`
    - 使用 fast-check 生成随机 thread 列表和 agent ID，验证筛选结果的完整性和正确性
    - **验证需求: 14.4**

- [x] 13. 知识库系统增强
  - [x] 13.1 实现文件系统监听增强
    - 对知识库目录添加文件系统监听（chokidar 或 Node.js fs.watch）
    - 检测到变更时更新文件树显示
    - 已打开文件在 2 秒内刷新内容
    - 对监听事件进行 500ms 去抖处理
    - _需求: 13.1, 13.2, 13.3, 13.4, 13.5_

- [x] 14. 应用品牌更新
  - [x] 14.1 更新品牌标识
    - package.json 的 name 改为 "webclaw"，productName 改为 "WebClaw"
    - 更新应用窗口标题为 "WebClaw"
    - 更新 electron-builder 配置中的应用标识符
    - 保留 Eidux 的应用图标（assets/icon）
    - _需求: 17.1, 17.2, 17.3, 17.4, 17.5_

- [ ] 15. 集成测试
  - [ ]* 15.1 端到端消息流集成测试
    - 测试文件：`vitest/integration/e2e-message-flow.test.ts`
    - Mock WebSocket 服务器，验证完整的发送→接收→渲染流程
    - 验证 open_conversation / close_conversation 生命周期
    - 验证流式响应（stream_chunk → stream_end）完整流程
    - _需求: 3.2, 3.3, 3.4, 5.2, 5.3, 6.1, 6.2_

  - [ ]* 15.2 代码清理验证测试
    - 构建后检查无悬空引用
    - 验证 npm install 无冲突
    - _需求: 1.12, 16.4_

- [ ] 16. 最终检查点 - 全面验证
  - 确保所有测试通过，应用可正常构建和启动，ask the user if questions arise.

## 备注

- 标记 `*` 的子任务为可选，可跳过以加速 MVP 开发
- 每个任务引用了具体的需求编号以确保可追溯性
- 检查点任务确保增量验证
- 属性测试验证设计文档中定义的 8 个正确性属性
- 单元测试验证具体的边界条件和错误场景
- WebUI Plugin 的实现在 xgw repo 中进行，不在本任务范围内
