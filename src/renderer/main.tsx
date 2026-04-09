console.info('@@@1 Renderer scrpit starting...');

// 把 preload 注入的 userData读取出来，设置到 renderer 的全局变量里去。
const env = (window as any).env as {
  isDev: boolean;
  OS: string;
  appVer: string;
  appPath: string;
  userPath: string;
  versions: {
    electron: string;
    chrome: string;
    node: string;
    v8: string;
  };
};
console.info(`@@@2 Renderer scrpit starting (userData): dev = ${env.isDev}, ELECTRON_CONTEXT = renderer, OS = ${env.OS}, AppPath = ${env.appPath}, UserPath = ${env.userPath}`);

// 尽早注入关键全局变量，以便后续代码可以使用
import { setAppVer, setIsDev } from '@lib/env.js'
import { PATH_KB_EXAMPLE, PATH_KB_SYSTEM, set_PATH_APP, set_PATH_USER } from '@lib/paths.js';
setIsDev(env.isDev); setAppVer(env.appVer);
set_PATH_APP(env.appPath);
set_PATH_USER(env.userPath);

import { isDev, ELECTRON_CONTEXT, OS } from '@lib/env.js'
import { PATH_APP, PATH_USER } from '@lib/paths.js';
console.info(`@@@3 Renderer scrpit starting (lib/env): dev = ${isDev()}, ELECTRON_CONTEXT = ${ELECTRON_CONTEXT}, OS = ${OS}, AppPath = ${PATH_APP()}, UserPath = ${PATH_USER()}`);

/////////////////////////////////////////
// 从这里开始启用我们的日志记录器
import { Logger, Assert } from '@lib/logast.js'
Logger.info(`@@@ Renderer scrpit starting: dev = ${isDev()}, ELECTRON_CONTEXT = ${ELECTRON_CONTEXT}, OS = ${OS}, AppPath = ${PATH_APP()}, UserPath = ${PATH_USER()}`);

import { Provider } from 'react-redux';

import './styles/debug.css'
import './styles/base.css'

// App各部分的样式
import './styles/menu.css'
import './styles/app.css'
import './styles/navbar.css'
import './styles/tree.css'
import './styles/statusbar.css'
import './styles/tabarea.css'
import './styles/editor.css'

// markdown table 的相关样式(主要是 cell 内的 inline marks)
import '../editor/styles/table.css'

import { StrictMode } from 'react'
import { App } from './App.js'
import { createStore } from '@state/store.js';
import { setStore } from '@state/storeHolder.js'
import { createRoot } from 'react-dom/client'
import { dispatchCommand } from '@commands/registry.js';
import { ErrorBoundary } from '@lib/renderer/ErrorBoundary.js'
import { HotkeyProvider } from '@hotkeys/HotkeyProvider.js';
import { LogViewProvider } from "./modals/uiLogger.js";
import { asyncLoadSlashCommands } from "@ai/common/SlashCommands.js"
import { workspaceActions } from '@state/slices/workspace/slice.js';
import { settingsActions } from '@state/slices/settings/slice.js';
import { isFeatureEnabled, VERSION_SHOW_WELCOME_ON_STARTUP } from '@state/slices/settings/types.js';

const store = createStore()
Logger.info('Renderer: Store created successfully');
setStore(store);

async function init() {
  Logger.info('RendererAsyncInit', 'started');

  // 自动添加预置的知识库路径(会忽略已存在的路径)
  const dispatch = store.dispatch;
  if (store.getState().workspace.libPaths.length === 0) {
    dispatch(workspaceActions.addLibrary({ libPath: PATH_KB_SYSTEM() }));
    dispatch(workspaceActions.addLibrary({ libPath: PATH_KB_EXAMPLE() }));
    Logger.info('RendererAsyncInit', 'Default library paths added to workspace');
  }

  // 自动(根据workspace里的libPaths)刷新当前工作区的 所有Library和Tree
  await dispatchCommand('workspace/refreshAllLibraries', {});
  Logger.info('RendererAsyncInit', 'All workspace libraries refreshed');

  // 首次启动时自动打开欢迎文档
  const showWelcomeOnStartup = isFeatureEnabled(store.getState().settings.showWelcomeOnStartup, VERSION_SHOW_WELCOME_ON_STARTUP);
  if (showWelcomeOnStartup) {
    await dispatchCommand('tab/open/eidux-link', {link: '@kb/system/docs/WELCOME.md', pinned: true });
    dispatch(settingsActions.setShowWelcomeOnStartup(false));
  }

  // start async load the root prompt group
  await asyncLoadSlashCommands();
  Logger.info('RendererAsyncInit', 'All slash commands loaded');
}

init().then(() => {
  Logger.info('RendererAsyncInit', 'Completed');
}).catch((error) => {
  Logger.error('RendererAsyncInit', `FAILED: ${error}`);
});

Logger.info('Renderer: Rendering App component');  
createRoot(document.getElementById('root')!).render(
  // TODO: IMPORTANT: 在发布前应该启用 StrictMode 仔细测试一番。
  // 平时就关掉了，老强制渲染两次组件导致很多日志很烦。
  // <StrictMode>
    <ErrorBoundary
      fallback={<div>### ERROR ###</div>}
      onError={(error, info) => { Logger.error('ErrorBoundary caught an error:', error, info); }}>
      <Provider store={store}>
        <HotkeyProvider>
        <LogViewProvider>
          <App/>
        </LogViewProvider>
        </HotkeyProvider>
        </Provider>
    </ErrorBoundary>
  // </StrictMode>
);

Logger.info('@@@ Renderer script loaded successfully');
