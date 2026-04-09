import updater from "electron-updater";
const { autoUpdater } = updater;
import { Logger } from "@node/logger.js"
import { isDev } from "@lib/env.js";
import { emitAppEvent } from "./main.js";
import { BrowserWindow } from "electron/main";
import { shell, dialog } from "electron";

// macOS 是否使用开发者签名版本发布, TODO 正式签名时要改为 true
const MAC_DEVELOPER_SIGNED = false;

// undefined = 未检查，false = 无更新，true = 有更新已下载好
let updateReady: boolean | undefined = undefined;
let downloadedFilePath: string | null = null;

export function initAutoUpdater(autoInstall: boolean) {
  // 开发环境下启用调试配置
  if (isDev()) {
    autoUpdater.forceDevUpdateConfig = true;
    Logger.info("autoUpdater: forceDevUpdateConfig enabled (dev debugging).");
  }

  const platform = process.platform === 'darwin' ? 'mac' : process.platform === 'win32' ? 'win' : 'linux';
  autoUpdater.setFeedURL({
    provider: 'generic',
    url: `https://eidux.app/latest/${platform}/`
  });

  // 基本推荐配置
  autoUpdater.autoDownload = true;
  autoUpdater.disableWebInstaller = true;
  autoUpdater.autoRunAppAfterInstall = false;
  autoUpdater.autoInstallOnAppQuit = autoInstall;

  // 把日志对接到我们自己的 Logger
  autoUpdater.logger = null as any; // 先清空默认的
  // autoUpdater.logger = {
  //   info: (msg) => Logger.info(`autoUpdater: ${msg}`),
  //   warn: (msg) => Logger.warn(`autoUpdater: ${msg}`),
  //   error: (msg) => Logger.error(`autoUpdater: ${msg}`),
  //   debug: (msg) => Logger.debug(`autoUpdater: ${msg}`),
  // };

  autoUpdater.on("error", (err) => {
    Logger.error("AutoUpdater: error:", (err as Error)?.message || "...");
  });

  autoUpdater.on("checking-for-update", () => {
    //Logger.info("autoUpdater: checking-for-update");
  });

  autoUpdater.on("update-available", (info) => {
    Logger.debug("AutoUpdater: update-available", info);
  });

  autoUpdater.on("update-not-available", (info) => {
    Logger.debug("AutoUpdater: update-not-available", info);
  });

  autoUpdater.on("download-progress", (p) => {
    Logger.debug(`AutoUpdater: download-progress ${p.percent.toFixed(2)}%`);
  });

  autoUpdater.on("update-downloaded", (info) => {
    const { version, releaseName, downloadedFile, releaseDate, releaseNotes } = info;

    Logger.debug("AutoUpdater: update-downloaded", `version=${version} releaseName=${releaseName} downloadedFile=${downloadedFile} releaseDate=${releaseDate}`);
    //Logger.debug("AutoUpdater: update-downloaded releaseNotes:", releaseNotes);

    updateReady = true;
    downloadedFilePath = info.downloadedFile;

    const mainWindow = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    emitAppEvent(mainWindow, 'dispatchAppCommand', { appCommandId: 'system/updateReady', args: { version, releaseName, releaseDate,releaseNotes } });
  });

  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    Logger.error("checkForUpdatesAndNotify failed:", (err as Error)?.message || "...");
  });

  // 如果自动安装模式，那么延迟几秒就检查更新是否已经Ready(一般是上次就已经下载好的)，如Ready就自动退出并安装并重启
  if (autoInstall) {
    setTimeout(() => {
      const ready = isUpdateReady();
      if (ready === true) {
        Logger.info('AutoUpdater: autoInstall enabled, quitting and installing update...');
        // 自动退出并安装更新(显示安装界面，因为现在是用户正在启动应用中)
        quitAndInstallUpdate(false, true);
      }
    }, 3 * 1000); // 3秒后检查一次, 如果上次更新已经准备好，这个时间足够检测出状态来了。
  }
}

export function isUpdateReady(): boolean | undefined {
  return updateReady;
}

export function quitAndInstallUpdate(silent: boolean = true, restart: boolean = true) {
  Logger.info('AutoUpdater: quitAndInstallUpdate called, silent=', silent, ' restart=', restart);

  if (process.platform === 'darwin' && !MAC_DEVELOPER_SIGNED)
    showMacManualUpdateDialog();
  else
    autoUpdater.quitAndInstall(silent, restart);
}

function showMacManualUpdateDialog() {
  Logger.info("AutoUpdater: Showing macOS manual update dialog (not developer signed).");

  const mainWindow = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  dialog.showMessageBox(mainWindow,
    {
    type: 'info',
    buttons: ['我知道了'],
    message: '更新已下载',
    detail:
      '请将 WebClaw.app 解压后拖入 Applications 文件夹覆盖原应用，以完成更新。'
  });

  shell.showItemInFolder(downloadedFilePath!);
}
