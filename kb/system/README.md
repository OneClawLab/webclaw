# WebClaw 系统内置知识库
此知识库包含所有用户/开发者需要的有关WebClaw/TheClaw的文档/配置/模板/数据。

## slash-commands
存放 slash 命令 (即编辑器里用户可输入的 /开头的命令)对应的提示词模板
对用户可见，由用户在输入文本中 调用，并在发给底层之前 套用对应的模板。

## skills 目录
存放 以 agent skills 规范 开发的 skills。
每个子目录为一个 skill, 每个目录下的 SKILL.md 为该 skill 的详细描述。
大模型将根据用户场景，选择合适的 skill，并遵循该 skill的流程进行问题解答。
注: 系统内部设置了全局虚拟URI映射，因此大模型访问时使用 rs://skills/ 前缀访问。

## docs
此目录下存放各种文档: 系统说明书/用户指南/开发指南/帮助文档等。

**重要**: ==**要配置并启用 AI 功能**==，请阅读 @kb/system/docs/README.md
*Tips:  `Ctrl  (Mac下Command) + 鼠标点击` 链接，即可在新Tab页中打开。*

## logs
此目录下存放程序运行生成的一些特定Markdown格式的日志，用于系统调试/测试。
