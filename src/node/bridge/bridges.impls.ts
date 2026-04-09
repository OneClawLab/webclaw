import { Logger } from '@node/logger.js'
import { DirItem, FsIntf, FsStats, StorageIntf, UiIntf } from './bridges.types.js'

import fs from 'fs'
import { path } from '@lib/path.js'
import { snapshotDirSignature, snapshotFileSignature } from '@node/utils/snapshotFsItemSignature.js'

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { PATH_WINDOW_STORAGE } from '@lib/paths.js';

import { dialog, BrowserWindow } from 'electron/main'
import { shell } from 'electron/common'
import { quitAndInstallUpdate as qaiu } from '@node/autoupdate.js';

export class FsImpl extends FsIntf {
  // 读文本文件，默认编码为utf-8
  override readText(filePath: string, encoding: BufferEncoding = 'utf-8'): string {
    return fs.readFileSync(filePath, { encoding })
  }

  // 写文本文件，必要时会创建父目录，编码始终为utf-8
  override writeText(filePath: string, content: string): boolean {
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, content, 'utf-8')
    return true
  }

  // 检查文件或目录是否存在
  override exists(filePath: string): boolean {
    return fs.existsSync(filePath)
  }

  override stat(filePath: string): FsStats {
    const stat = fs.statSync(filePath);
    return {
      isFile: stat.isFile(),
      isDirectory: stat.isDirectory(),
      size: stat.size,
      mtime: stat.mtimeMs,
      ctime: stat.ctimeMs,
    };
  }

  // 生成指定文件的签名字符串，用于检测文件内容是否变化。
  override getFileSignature(filePath: string): string {
    return snapshotFileSignature(filePath);
  }

  // 生成指定目录的签名字符串，用于检测目录内容是否变化: 子目录/子文件/文件内容的各种变化。递归。
  override getDirSignature(dirPath: string): string {
    return snapshotDirSignature(dirPath);
  }

  // 列出目录下的所有文件和子目录（不递归），返回它们的属性
  override listDir(dirPath: string): DirItem[] {
    const entries = fs.readdirSync(dirPath);
    const entriesWithProps = entries.map((name) => {
      const fullPath = path.join(dirPath, name);
      const stat = fs.statSync(fullPath);
      return {
        name,
        path: path.toPosixPath(fullPath),
        isDirectory: stat.isDirectory(),
        isFile: stat.isFile(),
        size: stat.size,
        mtime: stat.mtime,
        ctime: stat.ctime,
      };
    });

    return entriesWithProps.filter(entry => 
      (entry.isDirectory || entry.isFile) &&
      (entry.name !== '.' && entry.name !== '..'));
  }

  // 删除指定路径的文件或目录，recursive表示是否递归删除目录
  override delete(path: string, recursive: boolean): boolean {
    try {
      if (fs.existsSync(path))
        fs.rmSync(path, { recursive, force: true });
      return true;
    } catch (err) {
      Logger.error('fs', `Failed to delete path: ${path}`, err);
      return false;
    }
  }

  // 重命名文件或目录
  override rename(oldPath: string, newPath: string): boolean {
    try {
      fs.renameSync(oldPath, newPath);
      return true;
    } catch (err) {
      Logger.error('fs', `Failed to rename from ${oldPath} to ${newPath}`, err);
      return false;
    }
  }

  // 如果目录不存在，则创建它（包括必要的父目录），否则不做任何操作
  override ensureDir(dirPath: string): boolean {
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      return true;
    } catch (err) {
      Logger.error('fs', `Failed to create directory: ${dirPath}`, err);
      return false;
    }
  }

  // 如果文件不存在，则创建它（包括必要的父目录），否则不做任何操作
  override ensureFile(filePath: string): boolean {
    try {
      if (!fs.existsSync(filePath)) {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, '', { encoding: 'utf-8' });
      }
      return true;
    } catch (err) {
      Logger.error('fs', `Failed to create file: ${filePath}`, err);
      return false;
    }
  }
}

// Storage的根目录
let storageDir = '';

// 获取存储文件的完整路径
// 如果指定了 namespaces，则会在 storage 目录下创建对应的子目录
function getStorageFilePath(name: string, ext: string, namespaces?: string[]): string {
  if (storageDir.length == 0) {
    storageDir = PATH_WINDOW_STORAGE();
    if (!existsSync(storageDir))
      mkdirSync(storageDir, { recursive: true });
  }

  let fileDir = storageDir;
  if (namespaces && namespaces.length > 0) {
    fileDir = path.join(storageDir, ...namespaces);
    if (!existsSync(fileDir))
      mkdirSync(fileDir, { recursive: true });
  }

  return path.join(fileDir, `${name}${ext}`);
}

export class StorageImpl extends StorageIntf {
  override exists(name: string, namespaces?: string[]): boolean {
    const file = getStorageFilePath(name, '.json', namespaces);
    try {
      //Logger.debug('storage:exists', `Checking if data file exists at ${file}`);
      return existsSync(file);
    } catch (err) {
      Logger.error('storage:exists', `Checking if data file exists at ${file} failed`, err);
      return false;
    }
  }

  override load(name: string, namespaces?: string[]): any | undefined {
    const file = getStorageFilePath(name, '.json', namespaces);
    try {
      //Logger.debug('storage:load', `Loading data from ${file}`);
      const raw = readFileSync(file, 'utf-8');
      return JSON.parse(raw);
    } catch (err) {
      Logger.error('storage:load', `Loading data from ${file} failed`, err);
      return undefined
    }
  }

  // 约定: content 中的字段名为 _ 开头的字段不会被保存(需要定义为?:形式，否加载时没值会报错)
  override save(name: string, content: any, namespaces?: string[]): boolean {
    const file = getStorageFilePath(name, '.json', namespaces);
    try {
      //Logger.debug('storage:save', `Saving data to ${file}`, content);
      const content_str = JSON.parse(JSON.stringify(content, (key, value) => {
        if (key.startsWith('_'))
          return undefined;
        return value;
      }));
      writeFileSync(file, JSON.stringify(content_str, null, 2), 'utf-8');
      return true;
    } catch (err) {
      Logger.error('storage:save', `Saving data to ${file} failed`, err);
      return false;
    }
  }
}

const getWindow = () => BrowserWindow.getFocusedWindow()!

// UI实现类，使用Electron的dialog和shell模块
// 注: 所有路径都使用posix格式，从源头保证系统中的路径的统一性。
export class UiImpl extends UiIntf {
  override async openFile(options?: {
    title?: string
    defaultPath?: string
    filters?: Electron.FileFilter[]
    allowMultiple?: boolean
  }): Promise<string[] | null> {
    const result = await dialog.showOpenDialog(getWindow(), {
      title: options?.title ?? '打开文件',
      defaultPath: options?.defaultPath,
      filters: options?.filters,
      properties: [
        'openFile',
        ...(options?.allowMultiple ? ['multiSelections'] as const : [])
      ]
    })
    return result.canceled ? null : result.filePaths.map(path.toPosixPath);
  }

  override async saveFile(options?: {
    title?: string
    defaultPath?: string
    filters?: Electron.FileFilter[]
  }): Promise<string | null> {
    const result = await dialog.showSaveDialog(getWindow(), {
      title: options?.title ?? '保存文件',
      defaultPath: options?.defaultPath,
      filters: options?.filters
    });
    return result.canceled ? null : path.toPosixPath(result.filePath) ?? null;
  }

  override async openDirectory(options?: {
    title?: string
    defaultPath?: string
    allowMultiple?: boolean
  }): Promise<string[] | null> {
    const result = await dialog.showOpenDialog(getWindow(), {
      title: options?.title ?? '选择文件夹',
      defaultPath: options?.defaultPath,
      properties: [
        'openDirectory',
        ...(options?.allowMultiple ? ['multiSelections'] as const : [])
      ]
    })
    return result.canceled ? null : result.filePaths.map(path.toPosixPath);
  }

  override async selectDirectoryToSave(options?: {
    title?: string
    defaultPath?: string
  }): Promise<string | null> {
    const result = await dialog.showOpenDialog(getWindow(), {
      title: options?.title ?? '选择保存目录',
      defaultPath: options?.defaultPath,
      properties: ['openDirectory', 'createDirectory']
    })
    return result.canceled || result.filePaths.length === 0
      ? null
      : path.toPosixPath(result.filePaths[0]);
  }

  // 在系统文件管理器中显示该文件
  override async showInExplorer(fullPath: string): Promise<void> {
    shell.showItemInFolder(fullPath)
  }

  // 在系统默认浏览器(或注册的 handler)中打开外部链接
  override async openExternal(url: string): Promise<void> {
    // shell.openExternal 会交给系统处理（默认浏览器等）
    await shell.openExternal(url)
  }

  // 退出并安装更新
  override async quitAndInstallUpdate(): Promise<void> {
    qaiu(false, true);
  }
}

export function getBridgeImpls() {
  return {
    fs: new FsImpl(),
    storage: new StorageImpl(),
    ui: new UiImpl()
  }
}
