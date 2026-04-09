/**
 * @type {import('electron-builder').Configuration}
 */

// EIDUX_MODE: 'dev' | 'release'
const mode = process.env.EIDUX_MODE;

export default {
  appId: 'com.webclaw.app',
  productName: 'WebClaw',
  copyright: '2026 The WebClaw Authors. All rights reserved.',
  compression: "normal",   // store | normal | maximum
  npmRebuild: false,
  buildDependenciesFromSource: false,
  nodeGypRebuild: false,
  directories: {
    buildResources: 'build'
  },
  icon: 'assets/icon', // 源 png，electron-builder 会生成 icns/ico
  extraMetadata: {
    eiduxMode: mode
  },  
  extraResources: [
    {
      from: 'kb',
      to: 'kb',
      filter: ['system/**', 'example/**'] // 只拷贝这两个目录
    },
    {
      from: 'workos',
      to: 'workos',
      filter: ['**/*']
    }
  ],
  files: [
    "!**/*.map",
    '!**/.vscode/*',
    '!src/*',
    '!electron.vite.config.{js,ts,mjs,cjs}',
    '!.eslintcache',
    '!eslint.config.mjs',
    '!.prettierignore',
    '!.prettierrc.yaml',
    '!dev-app-update.yml',
    '!CHANGELOG.md',
    '!README.md',
    '!.env',
    '!.npmrc',
    '!pnpm-lock.yaml',
    '!tsconfig.json',
    '!tsconfig.*.json',
  ],
  asarUnpack: [
    'resources/**',
  ],
  afterPack: './scripts/remove_locales.mjs',

  // Windows, nsis(.exe安装包，+blockmap, 首次安装和自动更新都用)
  win: {
    target: 'nsis',
    executableName: 'WebClaw',
  },
  nsis: {
    artifactName: '${productName}-${version}-setup.${ext}',
    shortcutName: '${productName}',
    uninstallDisplayName: '${productName}',
    createDesktopShortcut: 'always',
  },

  // Mac, Apple Silicon + Intel, dmg(首次安装用) + zip(+blockmap，自动更新用)
  mac: {
    target: [
      { target: 'zip', arch: ['arm64', 'x64'] },
      { target: 'dmg', arch: ['arm64', 'x64'] }
    ],
    icon: 'assets/icon.icns',        // 打包用 icns
    hardenedRuntime: false,          // 探索阶段不用
    identity: null,                  // 自签名，null 表示默认自签名
    entitlementsInherit: 'build/entitlements.mac.plist',
    extendInfo: {
      NSCameraUsageDescription: "Application requests access to the device's camera.",
      NSMicrophoneUsageDescription: "Application requests access to the user's microphone.",
      NSDocumentsFolderUsageDescription: "Application requests access to the user's Documents folder.",
      NSDownloadsFolderUsageDescription: "Application requests access to the user's Downloads folder."
    },
    notarize: false,                // 探索阶段不走 notarization
    category: "public.app-category.productivity",
    electronLanguages: ['en', 'zh-CN', 'zh-TW', 'zh-HK'],
  },

  // DMG 配置
  dmg: {
    artifactName: '${productName}-${version}-${arch}.${ext}',
    contents: [
      { x: 130, y: 220 },
      { x: 410, y: 220, type: "link", path: "/Applications" }
    ]
  },

  // Linux
  linux: {
    target: ['AppImage', 'snap', 'deb'],
    maintainer: 'electronjs.org',
    category: 'Utility'
  },
  appImage: {
    artifactName: '${productName}-${version}.${ext}'
  },

  npmRebuild: false,

  // 本地自动更新测试时的配置
  // publish: {
  //   provider: 'generic',
  //   url: "https://eidux.app/"
  // },

  // 使用 GitHub Actions 发布到 GitHub Releases 的配置
  // publish: [{
  //   provider: 'github',
  //   owner: 'chinsyoui',
  //   repo: 'eidux',
  //   private: true
  // }],

  // 使用 Electron Builder 发布到 S3 静态托管的配置
  // publish: [{
  //   provider: 'generic',
  //   url: 'https://eidux.app/'
  // }]

  // 目前使用 GitHub Actions 上传到 S3，不使用 electron-builder 发布功能
  // 即发布功能在 .github/workflows/*.yml 中实现
  publish: []
}
