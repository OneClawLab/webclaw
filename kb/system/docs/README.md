系统说明书/用户指南/开发指南/帮助文档等。

# MacOS: 临时指南(目前App未正式签名，所以比较麻烦)

**Mac下安装dmg文件后，需要再做以下事情才能正常运行**:
1. Settings->隐私于安全性->安全性->允许以下来源的应用程序 改成 任何来源
2. 命令行执行 sudo spctl --global-disable
3. 命令行执行 sudo xattr -dr com.apple.quarantine /Applications/WebClaw.app

# 配置并启用 AI 功能

WebClaw 要求在本地安装配置启动了 TheClaw。
