export type DirItem = {
  name: string,
  path: string,
  isDirectory: boolean,
  isFile: boolean,
  size: number,
  mtime: Date,
  ctime: Date,
};

export type FsStats = {
  isFile: boolean,
  isDirectory: boolean,
  size: number,
  mtime: number,
  ctime: number,  
};

// 文件系统模块接口
export class FsIntf {
  // 读文本文件，默认编码为utf-8
  readText(filePath: string, encoding: BufferEncoding): string { throw new Error('Not implemented'); }
  // 写文本文件，必要时会创建父目录，编码始终为utf-8
  writeText(filePath: string, content: string): boolean { throw new Error('Not implemented'); }
  // 检查文件或目录是否存在
  exists(filePath: string): boolean { throw new Error('Not implemented'); }
  // 获取文件或目录的属性，必须已存在才能调用
  stat(filePath: string): FsStats { throw new Error('Not implemented'); }
  // 生成指定文件的签名字符串，用于检测文件内容是否变化。
  getFileSignature(filePath: string): string { throw new Error('Not implemented'); }
  // 生成指定目录的签名字符串，用于检测目录内容是否变化: 子目录/子文件/文件内容的各种变化。递归。
  getDirSignature(dirPath: string): string { throw new Error('Not implemented'); }
  // 列出目录下的所有文件和子目录（不递归），返回它们的属性
  listDir(dirPath: string): DirItem[] { throw new Error('Not implemented'); }
  // 删除指定路径的文件或目录，recursive表示是否递归删除目录
  delete(path: string, recursive: boolean): boolean { throw new Error('Not implemented'); }
  // 重命名文件或目录
  rename(oldPath: string, newPath: string): boolean { throw new Error('Not implemented'); }
  // 如果目录不存在，则创建它（包括必要的父目录），否则不做任何操作
  ensureDir(dirPath: string): boolean { throw new Error('Not implemented'); }
  // 如果文件不存在，则创建它（包括必要的父目录），否则不做任何操作
  ensureFile(filePath: string): boolean { throw new Error('Not implemented'); }
};

// JSON对象存储模块接口，指定(在可选的层级命名空间中的)唯一名称，进行数据的存取
export class StorageIntf {
  // 检查指定存储文件是否存在
  exists(name: string, namespaces?: string[]): boolean { throw new Error('Not implemented'); }
  // 加载指定存储文件的数据，返回 undefined 表示不存在
  load(name: string, namespaces?: string[]): any | undefined { throw new Error('Not implemented'); }
  // 保存数据到指定的存储文件
  // 约定: content 中的字段名为 _ 开头的字段不会被保存(需要定义为?:形式，否加载时没值会报错)
  save(name: string, content: any, namespaces?: string[]): boolean { throw new Error('Not implemented'); }
};

// UI交互模块接口
export class UiIntf {
  openFile(options?: {
    title?: string
    defaultPath?: string
    filters?: Electron.FileFilter[]
    allowMultiple?: boolean
  }): Promise<string[] | null> { throw new Error('Not implemented'); }

  saveFile(options?: {
    title?: string
    defaultPath?: string
    filters?: Electron.FileFilter[]
  }): Promise<string | null> { throw new Error('Not implemented'); }

  openDirectory(options?: {
    title?: string
    defaultPath?: string
    allowMultiple?: boolean
  }): Promise<string[] | null> { throw new Error('Not implemented'); }

  selectDirectoryToSave(options?: {
    title?: string
    defaultPath?: string
  }): Promise<string | null> { throw new Error('Not implemented'); }

  // 在系统文件管理器中显示该文件
  showInExplorer(fullPath: string): Promise<void> { throw new Error('Not implemented'); }

  // 在系统默认浏览器(或注册的 handler)中打开外部链接
  openExternal(url: string): Promise<void> { throw new Error('Not implemented'); }

  // 退出并安装更新
  quitAndInstallUpdate(): Promise<void> { throw new Error('Not implemented'); }
}

export function getBridgeIntfs() {
  return {
    fs: new FsIntf(),
    storage: new StorageIntf(),
    ui: new UiIntf(),
  }
}
