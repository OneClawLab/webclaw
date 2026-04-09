# 需求文档：Webclaw Client

## 简介

Webclaw 是基于 Eidux 桌面应用改造的 TheClaw agent 运行时系统的全功能桌面客户端。改造在 eidux repo 的独立分支（webclaw）上进行，不会合并回 Eidux 主线。改造的核心是：彻底移除 Eidux 内置的 AI 服务层（src/ai/node/）、后端服务（backend/）、向量数据库（lancedb_natives/）等所有与 Webclaw Client 定位无关的代码和资源，替换为通过 WebSocket 连接 xgw 通信网关的 webui 插件，使所有 AI 能力由 TheClaw 的 xar+xgw+pai 提供。保留 Eidux 的 Markdown 编辑器、知识库管理、Redux 状态管理、文件树、标签页等核心前端功能。新增 xgw WebSocket 客户端、Agent 选择 UI、连接设置、Thread 浏览器等功能。

## 术语表

- **Webclaw**: 基于 Eidux 改造的 TheClaw 桌面客户端应用
- **TheClaw**: 多 agent 运行时平台，由 xar、xgw、pai、thread 等组件组成
- **xgw**: TheClaw 的通信网关 daemon，负责外部渠道与 agent 之间的双向消息桥接
- **xar**: TheClaw 的 Agent 运行时 daemon，管理 agent 生命周期和消息处理
- **pai**: TheClaw 的 LLM 交互层，支持 20+ providers
- **thread**: TheClaw 的持久化事件流容器，基于 SQLite + JSONL
- **WebUI_Plugin**: xgw 中新增的 channel 插件，支持多会话复用的 WebSocket 协议，服务 Webclaw 桌面客户端和未来的浏览器客户端
- **WebUI_Frame**: WebUI_Plugin 使用的帧协议消息类型
- **Main_Process**: Electron 的主进程（Node.js 环境），负责 WebSocket 连接和系统级操作
- **Renderer_Process**: Electron 的渲染进程（浏览器环境），负责 React UI 渲染
- **IPC_Bridge**: Electron 的进程间通信桥接层，连接 Main_Process 和 Renderer_Process
- **Conversation**: 一个会话，对应 xgw 中的 conversation_id，映射到 xar 中的一个 thread
- **Document**: Webclaw 中的文档，每个 Document 对应一个 Conversation
- **Agent**: TheClaw 中的自治智能体，由 IDENTITY.md + config.json 声明式定义
- **Knowledge_Base**: 知识库，本地目录管理系统，由 LibraryFactory/LibraryStore 实现
- **Slash_Command**: 编辑器中的 / 命令系统，纯前端 prompt 模板
- **At_Reference**: 编辑器中的 @ 引用机制，作为知识库路径的快捷方式，方便在消息中引用文件或目录路径
- **CodeMirror_Editor**: 基于 CodeMirror 6 的所见即所得 Markdown 编辑器
- **Connection_Settings**: Webclaw 的 xgw 连接配置（host/port/channel/peer）
- **Thread_Browser**: 浏览 ~/.theclaw/agents/<id>/threads/ 目录的 UI 组件

## 需求

### 需求 1：代码库清理（移除所有与 Webclaw Client 定位无关的内容）

**用户故事：** 作为开发者，我希望彻底清理 Eidux 代码库中所有与 Webclaw Client 定位无关的代码、目录和配置，使代码库干净地聚焦于 TheClaw 桌面客户端的职责。此分支不会合并回 Eidux 主线。

#### 验收标准

1. THE Webclaw SHALL 移除 src/ai/node/ 目录下的全部代码（agent、llm、rag、tools、skill、server、reference、misc、context 模块）
2. THE Webclaw SHALL 移除 src/http/ 目录下的 AI HTTP 服务器相关代码（Eidux 内嵌的 Fastify AI server）
3. THE Webclaw SHALL 移除 backend/ 整个目录（llm-proxy、mock-llm-service、supabase、website 均为 Eidux 独立后端服务，与 Webclaw Client 无关）
4. THE Webclaw SHALL 移除 lancedb_natives/ 整个目录（LanceDB 原生二进制文件，不再需要向量数据库）
5. THE Webclaw SHALL 移除 kb/system/skills/ 和 kb/system/prompts/ 目录中的 agent 配置文件（由 TheClaw 的 IDENTITY.md + SKILL 机制取代）
6. THE Webclaw SHALL 移除 .env.example 和 .env 中的 LLM API key 配置项（由 TheClaw 的 pai 配置取代）
7. THE Webclaw SHALL 移除 AI 相关的 Node.js 初始化逻辑（LanceDB、LlamaIndex、Fastify AI server 初始化）
8. THE Webclaw SHALL 移除 electron-builder 配置中 asarUnpack 的 @lancedb 和 apache-arrow 条目
9. THE Webclaw SHALL 移除 .github/ 目录中 Eidux 特有的 CI/CD 配置和 copilot-instructions.md
10. THE Webclaw SHALL 移除 Supabase 相关代码和依赖（@supabase/supabase-js）
11. THE Webclaw SHALL 保留 src/ai/common/ 目录中与 Slash Command 和 @ Reference 相关的共享代码
12. THE Webclaw SHALL 确保清理后应用能正常启动，不存在对已删除模块的悬空引用

### 需求 2：xgw WebSocket 客户端

**用户故事：** 作为用户，我希望 Webclaw 能通过 WebSocket 连接到 xgw 的 WebUI_Plugin，以便与 TheClaw 的 agent 进行实时交互。

#### 验收标准

1. THE Main_Process SHALL 实现 xgw WebSocket 客户端，连接到 WebUI_Plugin 的 WebSocket 端点
2. WHEN WebSocket 连接建立时，THE Main_Process SHALL 发送 hello 帧（包含 channel_id 和 peer_id）并等待 hello_ack 响应
3. WHEN 收到 hello_ack 帧时，THE Main_Process SHALL 将连接状态标记为已认证并通知 Renderer_Process
4. IF WebSocket 连接断开，THEN THE Main_Process SHALL 使用指数退避策略自动重连（初始 1 秒，上限 60 秒，最多尝试 10 次）
5. WHILE WebSocket 连接处于已认证状态，THE Main_Process SHALL 每 30 秒发送 ping 帧以维持连接
6. WHEN 收到 pong 帧时，THE Main_Process SHALL 更新最后心跳时间戳
7. IF 连续 3 次 ping 未收到 pong 响应，THEN THE Main_Process SHALL 关闭当前连接并触发重连
8. IF 收到 error 帧，THEN THE Main_Process SHALL 将错误信息转发给 Renderer_Process 并在 UI 中展示

### 需求 3：WebUI 帧协议

**用户故事：** 作为用户，我希望 Webclaw 支持多会话复用的帧协议，以便在单个 WebSocket 连接上同时管理多个 Conversation。

#### 验收标准

1. THE Main_Process SHALL 实现以下 WebUI_Frame 类型的序列化和反序列化：hello、hello_ack、error、open_conversation、close_conversation、message、stream_chunk、stream_end、progress、ping、pong
2. WHEN 用户打开一个 Document 时，THE Main_Process SHALL 发送 open_conversation 帧（携带 conversation_id）
3. WHEN 用户关闭一个 Document 时，THE Main_Process SHALL 发送 close_conversation 帧（携带 conversation_id）
4. WHEN 用户在 Document 中发送消息时，THE Main_Process SHALL 发送 message 帧（携带 conversation_id 和 text）
5. THE Main_Process SHALL 根据 WebUI_Frame 中的 conversation_id 将入站帧路由到对应的 Document
6. FOR ALL WebUI_Frame 类型，序列化后再反序列化 SHALL 产生与原始帧等价的对象（round-trip 属性）

### 需求 4：WebUI 帧协议解析器与序列化器

**用户故事：** 作为开发者，我希望有独立的帧协议解析/序列化模块，以便可靠地处理 WebUI_Plugin 的通信协议。

#### 验收标准

1. THE Frame_Parser SHALL 将 JSON 字符串解析为类型安全的 WebUI_Frame 对象
2. IF 收到无法解析的 JSON 字符串，THEN THE Frame_Parser SHALL 返回描述性错误（包含原始输入摘要）
3. IF 收到缺少必要字段的 JSON 对象，THEN THE Frame_Parser SHALL 返回描述性错误（指明缺失字段）
4. THE Frame_Serializer SHALL 将 WebUI_Frame 对象格式化为 JSON 字符串
5. FOR ALL 合法的 WebUI_Frame 对象，解析后序列化再解析 SHALL 产生与原始对象等价的结果（round-trip 属性）

### 需求 5：Electron IPC 桥接层

**用户故事：** 作为用户，我希望 Main_Process 与 Renderer_Process 之间有高效的通信桥接，以便实时接收 agent 的流式响应。

#### 验收标准

1. THE IPC_Bridge SHALL 提供以下通道：连接状态变更、发送消息、接收流式 token、接收进度事件、接收完整消息、接收错误
2. WHEN Main_Process 收到 stream_chunk 帧时，THE IPC_Bridge SHALL 将 token 文本和 conversation_id 转发给 Renderer_Process
3. WHEN Main_Process 收到 stream_end 帧时，THE IPC_Bridge SHALL 通知 Renderer_Process 对应 Conversation 的流式传输已结束
4. WHEN Main_Process 收到 progress 帧时，THE IPC_Bridge SHALL 将进度事件（kind 和 text）及 conversation_id 转发给 Renderer_Process
5. WHEN Renderer_Process 请求发送消息时，THE IPC_Bridge SHALL 将消息文本和 conversation_id 传递给 Main_Process
6. THE IPC_Bridge SHALL 使用 Electron 的 contextBridge API 暴露类型安全的接口，Renderer_Process 不直接访问 Node.js API

### 需求 6：流式响应渲染

**用户故事：** 作为用户，我希望在 Document 中实时看到 agent 的流式文本输出，以便获得流畅的交互体验。

#### 验收标准

1. WHEN 收到 stream_chunk 事件时，THE CodeMirror_Editor SHALL 将 token 文本追加到当前 Document 的 agent 响应区域
2. WHEN 收到 stream_end 事件时，THE CodeMirror_Editor SHALL 标记当前 agent 响应为完成状态
3. WHILE 流式传输进行中，THE CodeMirror_Editor SHALL 自动滚动到文档底部以跟踪最新内容
4. WHILE 流式传输进行中，THE Webclaw SHALL 禁用当前 Document 的消息发送功能
5. WHEN 收到 stream_chunk 事件时，THE CodeMirror_Editor SHALL 在 50 毫秒内将 token 渲染到文档中

### 需求 7：进度事件可视化

**用户故事：** 作为用户，我希望在 Document 中看到 agent 的思考过程、工具调用和执行结果，以便了解 agent 的工作状态。

#### 验收标准

1. WHEN 收到 kind 为 thinking 的 progress 事件时，THE CodeMirror_Editor SHALL 在 Document 中渲染为可折叠的"思考过程"Markdown 块
2. WHEN 收到 kind 为 tool_call 的 progress 事件时，THE CodeMirror_Editor SHALL 在 Document 中渲染为"工具调用"Markdown 块（显示工具名称和参数摘要）
3. WHEN 收到 kind 为 tool_result 的 progress 事件时，THE CodeMirror_Editor SHALL 在 Document 中渲染为"执行结果"Markdown 块（显示结果摘要）
4. WHEN 收到 kind 为 ctx_usage 的 progress 事件时，THE Webclaw SHALL 在状态栏中显示 context window 使用百分比
5. WHEN 收到 kind 为 compact_start 的 progress 事件时，THE Webclaw SHALL 在状态栏中显示"正在压缩会话..."提示
6. WHEN 收到 kind 为 compact_end 的 progress 事件时，THE Webclaw SHALL 更新状态栏显示压缩前后的 token 数量变化

### 需求 8：Document 与 Conversation 映射

**用户故事：** 作为用户，我希望每个 Document 对应一个 Conversation，以便"文档即聊天，聊天即文档"的范式在 TheClaw 架构下继续工作。

#### 验收标准

1. THE Webclaw SHALL 为每个 Document 维护一个唯一的 conversation_id（使用 nanoid 生成，不可变，与文件路径解耦）
2. WHEN 用户创建新 Document 时，THE Webclaw SHALL 生成新的 conversation_id（nanoid）并写入文档 frontmatter（`---\nconversation_id: xxx\nagent_id: admin\n---`）
3. WHEN 用户打开已有 Document 时，THE Webclaw SHALL 从文档 frontmatter 读取 conversation_id，并发送 open_conversation 帧
4. IF 打开的文档没有 frontmatter 中的 conversation_id，THEN THE Webclaw SHALL 将其视为普通文档（无聊天会话功能）
5. THE Webclaw SHALL 将聊天内容渲染为 Markdown 结构（用户消息和 agent 响应均为 Markdown 文本），而非 UI 卡片
6. THE Document 的 .md 文件是用户侧的主存储，用户可随时编辑修改（包括将聊天内容加工为普通文档）。TheClaw 的 thread 是 agent 侧的独立记录，两者内容可以不同
7. WHEN 用户在 Document 中输入消息并发送时，THE Webclaw SHALL 将用户消息作为 Markdown 标题块写入 Document，并通过 message 帧发送给 xgw
8. WHEN 收到 agent 的完整响应时，THE Webclaw SHALL 将响应文本作为 Markdown 内容追加到 Document 中
9. WHEN 文档被重命名或移动时，conversation_id 不变（因为它存在 frontmatter 里，与文件路径解耦），无需任何同步逻辑

### 需求 9：Agent 选择

**用户故事：** 作为用户，我希望在创建文档时选择与哪个 agent 交互，并且该绑定在会话开始后不可更改，以便与 TheClaw 的 thread 归属模型保持一致。

#### 验收标准

1. THE Webclaw SHALL 提供 Agent 选择 UI 组件，替代 Eidux 原有的模式选择（normal/advanced/skilled/custom/ems）
2. THE Webclaw SHALL 从 xgw 获取当前可用的 agent 列表（通过 hello_ack 帧的 agents 字段）
3. WHEN 用户创建新 Document 时，THE Webclaw SHALL 默认绑定 admin Agent，并允许用户在发送第一条消息之前切换 Agent
4. WHEN 用户发送第一条消息后，THE Webclaw SHALL 将该 Document 的 Agent 绑定锁定为不可更改（因为 TheClaw 的 thread 归属于特定 agent，不可跨 agent 迁移）
5. THE Webclaw SHALL 在编辑器工具栏中显示当前 Document 绑定的 Agent 名称：空文档时可点击切换，有聊天历史后变为只读标签
6. WHEN 用户打开 open_conversation 帧时，THE Webclaw SHALL 在帧中携带 agent_id 字段，指定该会话绑定的 agent
7. THE Webclaw SHALL 将 Document 绑定的 agent_id 持久化到文档元数据中

### 需求 10：连接设置

**用户故事：** 作为用户，我希望能配置 xgw 的连接参数，以便连接到不同环境的 TheClaw 实例。

#### 验收标准

1. THE Webclaw SHALL 提供 Connection_Settings UI，允许用户配置 xgw 的 host、port、channel_id 和 peer_id
2. THE Webclaw SHALL 将 Connection_Settings 持久化到本地配置文件中
3. THE Webclaw SHALL 提供默认连接配置：host 为 127.0.0.1，port 为 29212，channel_id 为 webui:default，peer_id 为 owner
4. WHEN 用户修改 Connection_Settings 并保存时，THE Main_Process SHALL 断开当前 WebSocket 连接并使用新配置重新连接
5. THE Webclaw SHALL 在连接设置界面显示当前连接状态（未连接、连接中、已连接、重连中）

### 需求 11：连接状态管理

**用户故事：** 作为用户，我希望随时了解与 xgw 的连接状态，以便在连接异常时及时处理。

#### 验收标准

1. THE Webclaw SHALL 在状态栏中持续显示当前 WebSocket 连接状态图标（已连接为绿色、重连中为黄色、断开为红色）
2. WHEN WebSocket 连接状态发生变化时，THE Webclaw SHALL 在 200 毫秒内更新状态栏图标
3. IF WebSocket 连接断开且自动重连失败，THEN THE Webclaw SHALL 显示通知提示用户检查 xgw 服务状态
4. WHILE WebSocket 连接处于断开状态，THE Webclaw SHALL 禁用所有消息发送功能并在编辑器中显示离线提示
5. WHEN WebSocket 连接从断开恢复为已连接时，THE Webclaw SHALL 重新发送所有已打开 Document 的 open_conversation 帧

### 需求 12：保留核心前端功能

**用户故事：** 作为用户，我希望 Webclaw 保留 Eidux 的核心编辑和管理功能，以便继续使用熟悉的工作流。

#### 验收标准

1. THE Webclaw SHALL 保留 Electron + electron-vite 框架及其构建配置
2. THE CodeMirror_Editor SHALL 保留所有现有的 Markdown 编辑功能（所见即所得、语法高亮、快捷键、扩展）
3. THE Webclaw SHALL 保留 Redux 状态管理及所有现有 slices（doc、tab、tree、workspace、settings、ui、lib、runtime、dialog、user）
4. THE Webclaw SHALL 保留文件树、标签页区域、侧面板等 UI 组件
5. THE Webclaw SHALL 保留 Slash_Command 系统（/why、/explain 等纯前端 prompt 模板）
6. THE Webclaw SHALL 保留 At_Reference 机制（在发送消息前内联知识库文件内容）
7. THE Webclaw SHALL 保留热键系统、Command 系统和 Event 系统
8. THE Webclaw SHALL 保留 electron-updater 自动更新功能
9. THE Webclaw SHALL 保留多平台打包能力（Windows/macOS/Linux）

### 需求 13：知识库系统保留与增强

**用户故事：** 作为用户，我希望知识库系统在 Webclaw 中继续工作，并能感知 agent 对文件的修改。

#### 验收标准

1. THE Webclaw SHALL 保留 Knowledge_Base 系统（LibraryFactory/LibraryStore、本地目录管理）
2. THE Webclaw SHALL 保留知识库的目录浏览、文件创建、文件编辑、文件删除功能
3. WHEN Agent 通过 bash_exec 工具修改了知识库目录中的文件时，THE Webclaw SHALL 通过文件系统监听检测到变更并更新文件树显示
4. WHEN 文件系统监听检测到知识库文件变更时，THE Webclaw SHALL 在 2 秒内刷新受影响文件的内容（如果该文件已在编辑器中打开）
5. THE Webclaw SHALL 对文件系统监听事件进行去抖处理（500 毫秒窗口），避免频繁刷新

### 需求 14：Thread 浏览器

**用户故事：** 作为用户，我希望能浏览 TheClaw agent 的 thread 历史，以便查看和回顾过去的交互记录。

#### 验收标准

1. THE Thread_Browser SHALL 读取 ~/.theclaw/agents/ 目录结构，列出所有 agent 及其全部 threads（包括其他渠道如 TUI、Telegram 产生的 thread）
2. WHEN 用户选择一个 thread 时，THE Thread_Browser SHALL 读取该 thread 的事件流并以 Markdown 格式渲染为只读 Document
3. THE Thread_Browser SHALL 显示每个 thread 的基本信息（创建时间、最后活动时间、事件数量）
4. THE Thread_Browser SHALL 支持按 agent 筛选 thread 列表
5. IF ~/.theclaw/ 目录不存在或不可访问，THEN THE Thread_Browser SHALL 显示提示信息引导用户检查 TheClaw 安装状态

### 需求 15：Redux 状态扩展

**用户故事：** 作为开发者，我希望 Redux 状态管理能支持 Webclaw 新增的功能模块。

#### 验收标准

1. THE Webclaw SHALL 新增 connection slice 管理 WebSocket 连接状态（status、host、port、channel_id、peer_id、last_heartbeat）
2. THE Webclaw SHALL 新增 agent slice 管理 agent 相关状态（available_agents 列表、default_agent_id）
3. THE Webclaw SHALL 在 doc slice 中扩展 conversation_id、agent_id、agent_locked 字段，关联 Document 与 Conversation 及其绑定的 Agent
4. THE Webclaw SHALL 移除 doc slice 中与 Eidux AI 模式相关的字段（mode 选择等）
5. WHEN connection slice 的 status 字段变化时，THE Webclaw SHALL 触发相应的 UI 更新

### 需求 16：依赖清理与新增

**用户故事：** 作为开发者，我希望 Webclaw 的依赖列表精简且准确，移除不再需要的重型 AI 依赖，新增必要的通信依赖。

#### 验收标准

1. THE Webclaw SHALL 从 dependencies 中移除以下包：@ai-sdk/anthropic、@ai-sdk/google、@ai-sdk/openai、ai、@lancedb/lancedb、@llamaindex/core、llamaindex、@tavily/core、apache-arrow、fastify、@fastify/cors、stream-json、cheerio、@supabase/supabase-js、just-bash、triple-beam
2. THE Webclaw SHALL 从 devDependencies 中移除 @napi-rs/cli（LanceDB native 构建工具）
3. THE Webclaw SHALL 新增 ws 包（WebSocket 客户端，用于 Main_Process 连接 xgw）
3. THE Webclaw SHALL 保留所有 CodeMirror 相关依赖、React 相关依赖、Redux 相关依赖、Electron 相关依赖、Tailwind CSS 相关依赖
4. WHEN 依赖清理完成后，THE Webclaw SHALL 能通过 npm install 成功安装所有依赖且无 peer dependency 冲突

### 需求 17：应用品牌更新

**用户故事：** 作为用户，我希望应用的品牌标识反映其作为 TheClaw 客户端的新定位。

#### 验收标准

1. THE Webclaw SHALL 将应用名称从 "Eidux" 更新为 "WebClaw"
2. THE Webclaw SHALL 更新 package.json 中的 name 字段为 "webclaw"，productName 字段为 "WebClaw"
3. THE Webclaw SHALL 更新应用窗口标题为 "WebClaw"
4. THE Webclaw SHALL 更新 electron-builder 配置中的应用标识符
5. THE Webclaw SHALL 保留 Eidux 的应用图标（assets/icon）

### 需求 18：Slash Command 适配

**用户故事：** 作为用户，我希望 Slash_Command 系统在 Webclaw 中继续工作，通过 xgw 将命令发送给 agent。

#### 验收标准

1. THE Webclaw SHALL 保留所有现有的 Slash_Command 定义（/why、/explain 等）
2. WHEN 用户触发 Slash_Command 时，THE Webclaw SHALL 将 prompt 模板展开后的文本通过 message 帧发送给 xgw，但在 Document 中只显示用户输入的原始 Slash_Command 文本（不展开显示）
3. THE Webclaw SHALL 支持用户通过知识库中的 Markdown 文件自定义 Slash_Command

### 需求 19：At Reference 适配

**用户故事：** 作为用户，我希望 @ 引用机制在 Webclaw 中继续工作，作为知识库路径的快捷方式方便地在消息中引用文件或目录。

#### 验收标准

1. THE Webclaw SHALL 保留 At_Reference 的编辑器 UI（@ 触发的自动补全菜单，列出知识库中的文件和目录）
2. WHEN 用户输入 @ 时，THE Webclaw SHALL 展示知识库路径的自动补全列表
3. WHEN 用户选择一个补全项时，THE Webclaw SHALL 将对应的知识库路径（如 @kb/example/README.md）插入到编辑器中
4. WHEN 用户发送包含 @ 路径引用的消息时，THE Webclaw SHALL 在发送前将 @kb/... 形式的路径展开为 POSIX 格式的文件系统绝对路径（如 /home/user/kb/example/README.md），因为 TheClaw 的 agent 不感知知识库概念，只认文件系统路径

### 需求 20：错误处理与恢复

**用户故事：** 作为用户，我希望 Webclaw 能优雅地处理各种错误情况，以便在异常发生时不丢失工作内容。

#### 验收标准

1. IF xgw 返回 error 帧，THEN THE Webclaw SHALL 在对应 Document 中以 Markdown 引用块格式显示错误信息
2. IF WebSocket 连接在流式传输过程中断开，THEN THE Webclaw SHALL 在 Document 中标记当前响应为"中断"状态并保留已接收的内容
3. IF 发送 message 帧时 WebSocket 连接不可用，THEN THE Webclaw SHALL 将消息缓存到本地队列，并在连接恢复后按序重发（最多缓存 50 条）
4. THE Webclaw SHALL 在 Document 中保留所有已渲染的聊天内容，即使 WebSocket 连接断开也不丢失已显示的内容

---

## 附录 A：Eidux Advanced / EMS Agent 功能分析

> 本附录记录 Eidux 中 advanced 和 ems 两个特殊 agent 的核心功能和编排逻辑，供将来在 TheClaw 体系中设计等价 agent 时参考。这些代码将在 webclaw 分支中被移除，但其设计思想可通过 TheClaw 的 IDENTITY.md + SKILL 机制复现。

### A.1 Advanced Agent（规划/执行模式）

**核心理念**：将复杂问题分解为"凝练 → 分类 → 规划 → 执行"的多阶段流水线。

**编排流程**：

```
用户输入
  → ProblemCondenser（凝练问题）
    - 输入：用户原始文本
    - 输出：CondensedTask（condensed_problem_description + key_constraints + required_outcome + collected_facts）
    - 工具：web_search、context_retrieve（可选）
    - 作用：将模糊的用户输入转化为结构化的任务描述，确保后续 planner 无需回看原始输入
  → ProblemSolver（解决问题）
    → TaskClassifier（任务分类）
      - 判断任务是 simple 还是 complex
      - 输出：{ type: "simple" | "complex", reason, confidence }
    → 分支：
      - simple → SimpleExecutor（直接执行，一次 LLM 调用完成）
      - complex → TaskPlanner（任务规划）
        - 将任务拆解为多个子任务（PlannedTask[]）
        - 子任务之间有依赖关系（depends_on）和数据流（input_params.source_task/source_field → output_params）
        - 输出经过拓扑排序和依赖校验
        → plan_executor（串行执行所有子任务）
          - 按拓扑序逐个调用 TaskExecutor
          - 每个 TaskExecutor 有独立的 prompt、tools（bash_exec + web_search）
          - 子任务之间通过 input_params/output_params 传递数据（value_inline 或 value_uri）
          - 最后一个子任务的 final_result 输出参数作为最终结果
```

**子 Agent 清单**：

| 子 Agent | 职责 | 有 Tools |
|----------|------|----------|
| problem_condenser | 凝练用户输入为结构化任务 | web_search, context_retrieve |
| task_classifier | 判断任务复杂度（simple/complex） | 无 |
| simple_executor | 直接执行简单任务 | bash_exec, web_search |
| task_planner | 将复杂任务拆解为子任务 DAG | 无 |
| task_executor | 执行单个子任务 | bash_exec, web_search |

**关键数据结构**：

- `CondensedTask`：凝练后的任务（description + constraints + required_outcome + collected_facts）
- `PlannedTask`：规划好的子任务（task_id + depends_on + input_params + output_params）
- `ExecutableTask`：可执行的子任务（input_params 已填充 runtime value）

**TheClaw 等价方案**：可以设计一个 "planner" agent，其 IDENTITY.md 描述规划/执行的工作流程。利用 TheClaw 的 `create_agent_task` tool 实现子任务分发，`bash_exec` 执行具体操作。核心差异：Eidux 的编排是代码硬编码的多 LLM 调用链，TheClaw 可以用单个 agent + 结构化 SKILL 实现类似效果，或者用 admin → worker agent 的任务分发模式。

---

### A.2 EMS Agent（ExoMind Scaffold / 外脑脚手架）

**核心理念**：EMS 是一套将复杂问题的认知负担"卸载"到外部结构化系统的方法论。它将问题解决过程从"连续思考"重构为"可反复加载、局部推进、结构自愈的系统运行"。

**三大结构化模块**：

1. **意图树（Intent Tree）**：目标的递归拆解
   - 树状结构：Root Goal → Sub-goals
   - 只描述 What（期望状态），不涉及 How
   - 状态：active / completed / blocked / frozen / deprecated

2. **假设图（Assumption Graph）**：管理认知边界
   - DAG 结构，假设之间有依赖关系
   - 假设支撑意图树中的子意图
   - 状态：unknown / validated / falsified
   - 每个假设可附带证据（Evidence，有强度分级：weak/moderate/strong）

3. **行动池（Action Pool）**：原子化执行单元
   - 每个 Action 针对特定的 Intent 和/或 Assumption
   - 角色化执行：架构者 / 维护者 / 探索者 / 推进者 / 复盘者
   - 状态：pending / in_progress / done / aborted

**EMS Tools（提供给 LLM 的工具集）**：

| 工具 | 功能 |
|------|------|
| ems_get_problem_summary | 获取问题概览（根意图 + 统计信息） |
| ems_get_intent_subtree | 获取意图子树 |
| ems_get_assumption_subgraph | 获取假设子图 |
| ems_get_actions_by_intent_ids | 按意图查询相关行动 |
| ems_get_actions_by_assumption_ids | 按假设查询相关行动 |
| ems_create_intent | 创建新意图 |
| ems_update_intent | 更新意图 |
| ems_delete_intent | 删除意图 |
| ems_create_assumption | 创建新假设 |
| ems_update_assumption | 更新假设 |
| ems_update_assumption_evidences | 更新假设的证据 |
| ems_delete_assumption | 删除假设 |
| ems_create_action | 创建新行动 |
| ems_update_action | 更新行动 |
| ems_delete_action | 删除行动 |

**编排流程**：

```
用户输入
  → ExoMindRuntime（单个 agent，配备 EMS tools + web_search）
    - System prompt 包含：EMS 方法论说明 + 当前问题上下文 + 当前关注点 + 会话历史
    - LLM 自主决定调用哪些 EMS tools 来操作意图树/假设图/行动池
    - 输出：{ output_to_user（Markdown）, output_to_controller（current_focus 更新）}
  → 问题上下文持久化到本地 JSON 文件
  → 记忆系统更新
```

**关键特点**：
- 问题上下文（ProblemContext）跨会话持久化，不随对话结束而丢失
- LLM 通过 tools 自主操作结构化数据，而非代码编排
- current_focus 机制让 LLM 在多轮对话中保持关注点连贯

**TheClaw 等价方案**：EMS 的设计天然适合 TheClaw 的 agent 模型。可以设计一个 "ems" agent：
- IDENTITY.md 描述 EMS 方法论和角色定义
- 问题上下文存储在 agent 的 workdir 中（JSON 文件），通过 bash_exec 读写
- EMS tools 可以实现为 bash_exec 可调用的 CLI 命令（如 `ems intent create ...`），或者直接在 IDENTITY.md 中指导 LLM 用 bash_exec 操作 JSON 文件
- TheClaw 的 thread memory 机制天然支持跨会话的 current_focus 持久化
