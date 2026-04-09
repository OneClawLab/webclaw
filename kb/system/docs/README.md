系统说明书/用户指南/开发指南/帮助文档等。

# MacOS: 临时指南(目前App未正式签名，所以比较麻烦)

**Mac下安装dmg文件后，需要再做以下事情才能正常运行**:
1. Settings->隐私于安全性->安全性->允许以下来源的应用程序 改成 任何来源
2. 命令行执行 sudo spctl --global-disable
3. 命令行执行 sudo xattr -dr com.apple.quarantine /Applications/Eidux.app

# 配置并启用 AI 功能

Eidux 的 AI 功能 要求在指定位置的 .env 文件中存放必要的配置信息。

## 1. 按照 .env 文件的示例
@kb/system/docs/env.md

## 2. 把正式的 .env 文件放置在以下路径
@internal/path/user/.env
(Windows/MacOS下都是 Documents/Eidux/下)
注: 文件名必须是 .env

## 3. 然后重启应用(或点击一下状态栏⚡图标)即可。
成功配置后，状态栏的 `⚡` 状态将显示正常。
