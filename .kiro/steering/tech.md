---
inclusion: always
---

# Technology Stack

## Core Technologies

- **Electron** v39: 跨平台桌面应用框架
- **React** v19 + TypeScript: UI 框架
- **electron-vite** v5: 基于 Vite 的 Electron 构建工具
- **TailwindCSS** v4: 样式框架
- **Redux Toolkit** v2: 状态管理
- **CodeMirror** v6: 编辑器核心

## 关键依赖

### 前端（Renderer 进程）
- **UI**: Lucide React（图标）、Floating UI、Radix UI
- **工具**: Hotkeys.js、Nanoid、Zod

### 通信层（Main 进程）
- **ws**: WebSocket 客户端，连接 xgw WebUI Plugin
- **自定义帧协议**: src/lib/webui-protocol/（JSON over WebSocket）

### 构建与打包
- **tsup**: 无（使用 electron-vite）
- **electron-builder** v26: 打包与发布
- **Winston**: 日志

## 构建命令

```bash
npm run dev            # 开发模式（HMR + DevTools）
npm run build          # 开发构建
npm run build:release  # 发布构建（压缩、去 sourcemap）
npm run typecheck      # 类型检查（release tsconfig）
npm run typecheck:dev  # 类型检查（dev tsconfig）
```

## 打包命令

```bash
npm run release:win    # Windows (.exe NSIS)
npm run release:mac    # macOS (.dmg + .zip)
npm run release:linux  # Linux (AppImage + snap + deb)
```

## 配置文件

- **electron.vite.config.ts**: 构建配置（含路径别名）
- **tsconfig.json**: TypeScript 项目引用（拆分为 node/web × release/dev）
- **electron-builder.config.mjs**: 打包配置（appId: com.webclaw.app）
- **eslint.config.mjs**: ESLint 规则

## 开发环境

- Node.js >= 22
- ES modules (type: "module")
- Electron DevTools（inspect 5858，remote debugging 9222）
- Vite HMR（renderer 进程热重载）

## 自动更新

- electron-updater 内置
- Windows: latest.yml + .exe + .blockmap
- macOS: latest-mac.yml + .dmg + .zip
