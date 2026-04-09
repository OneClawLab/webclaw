---

特殊目录名约定(可出现在任意层级)：
 - node: main进程专用代码
 - renderer: renderer进程专用代码

其他目录名: 视情况而定，属于 main/renderer 的其中一个。

---

# node
electron node.js 的 main/preload 进程模块
main/renderer 之间 互相调用的 bridge 机制

# types
全局 types 定义, 无需import即可使用的类型定义

# commands
(renderer进程)
全局 command 模块

# event
(renderer进程)
全局 事件机制

# hotkeys
(renderer进程)
全局 热键机制

# http
(main/renderer进程)
http 框架

# lib
(main/renderer混合代码，默认为共享代码)
全局 lib 库模块

# hack 
(renderer进程)
一些 底层库的 hack 魔改代码

# view
(renderer进程)
app 前端的 视图管理模块

# library
(renderer进程)
知识库模块

# state
(renderer进程)
app 前端的 Redux 全局状态

## middlewares
Redux 中间件

## slices
Redux State的子模块(slices)

# editor
(renderer进程)
app 前端的 文档编辑器(CodeMirror)相关功能

## extensions
CodeMirror的扩展

## styles
Editor 的 styling 定义

## commands
Editor 专用的 Command 模块，用于Editor的工具栏

## providers
一些 CM扩展的 数据提供源
如：CommandTrigger (编辑器里的 /@! 快捷命令)

# renderer
(renderer进程)
app 前端的 主要界面实现

## layout
app 前端的主布局组件

## views
app 前端的 较大的界面组件

## modals
app 前端的 对话框

## compoments
一般小组件

## dropdowns
下拉菜单组件

## styles
app 前端的 styles

# scripts
build专用脚本，非app代码

# assets
程序内嵌的资源/数据文件

# /ai
(main/renderer混合代码，默认为main进程)
全部ai相关功能

## /ai/server
ai http server端，main进程代码。
基于 http server 模块 封装 ai 实现功能。

## /ai/client
ai http client端，renderer进程代码。
基于 http server 访问 ai server 的能力。

## /ai/reference
@机制的实现

## /ai/llm
对LLM/RAG等大模型底层调用的封装

## /ai/agent
/机制的实现

## /ai/tools
实现供大模型使用的tools机制

## /ai/misc
其他杂类功能

## /ai/common
(main/renderer共享的代码)
ai client/server 端同时需要的功能
