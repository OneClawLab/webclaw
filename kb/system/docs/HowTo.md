# 如何 使用 `custom` agent

`custom` agent 指用户可以自定义 SYSTEM PROMPT。、

**使用方法如下:**

1. 在文档打开后，(通过编辑器工具栏)切换文档自己的 agent 设置为 `custom`。
2. 在文档开头，以代码块的形式 加入自定义 SYSTEM PROMPT:

````custom_system_prompt
Your custom system prompt here...
````

注: 代码块起止标记可以是3个或更多个`

3. 然后，随后的问答就会自动使用该自定义SYSTEM PROMPT了。

