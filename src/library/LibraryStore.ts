import { Assert, Logger } from '@lib/logast.js'
import { path } from '@lib/path.js'
import type { LibModel } from './types.js'
import { LibraryFactory } from './LibraryFactory.js'
import { TreeNode } from '@state/slices/tree/types.js'
import { TreeUtils } from '@state/slices/tree/utils.js'

// Library: 创建/加载/保存/移除/获取/列举
// Chunk: 打开/更新/关闭/获取/列举
class LibraryStore {
  // libId -> LibraryModel
  private libs = new Map<string, LibModel>()

  // ---------- Library 管理 ---------- //

  // 创建 Library
  async createLibrary(path: string): Promise<LibModel> {
    const library = await LibraryFactory.create(path)
    this.libs.set(library.meta.id, library)
    return library
  }

  // 加载 Library
  async loadLibrary(path: string): Promise<LibModel> {
    const library = await LibraryFactory.load(path)
    this.libs.set(library.meta.id, library)
    return library
  }

  // 保存 Library
  async saveLibrary(libId: string): Promise<void> {
    const lib = this.libs.get(libId)
    if (!lib) 
      throw new Error(`Library not found: ${libId}`)
    await LibraryFactory.save(lib.meta, lib.path)
  }

  // 移除 Library
  removeLibrary(libId: string): void {
    this.libs.delete(libId)
  }

  // 获取 Library
  getLibrary(id: string): LibModel | undefined {
    return this.libs.get(id)
  }

  // 列举 Library
  listLibraries(): LibModel[] {
    return Array.from(this.libs.values())
  }

  // 加载指定 Library 的 TreeNodes
  async loadTreeNodes(libId: string, recursive: boolean = true): Promise<TreeNode[]> {
    const libPath = this.libs.get(libId)?.path;
    if (!libPath) {
      Logger.error('LibraryStore', `Library path not found for id: ${libId}`);
      return [];
    }
    return await TreeUtils.loadChildren(libPath, null, recursive);
  }

  // ---------- Document 管理 ---------- //

  async loadDocument(libId: string, docId: string, createIfNotExists: boolean = false): Promise<string> {
    const library = this.libs.get(libId)
    if (!library) 
      throw new Error(`Library not found: ${libId}`)
    const docPath = path.join(library.path, docId);
    if (!await window.fs.exists(docPath)) {
      if (!createIfNotExists)
        throw new Error(`Document not found: ${docId} in library: ${libId}`);
      await window.fs.writeText(docPath, '');
      Logger.debug('LibraryStore', `Created new document: ${docId} in library: ${libId}`);
    }
    const doc = await window.fs.readText(docPath);
    return doc!
  }

  async saveDocument(libId: string, docId: string, doc: string): Promise<void> {
    const library = this.libs.get(libId)
    if (!library) 
      throw new Error(`Library not found: ${libId}`)
    const docPath = path.join(library.path, docId);
    Logger.debug('LibraryStore', 'Saving document to:', docPath);
    await window.fs.writeText(docPath, doc);
  }

  async deleteDocument(libId: string, docId: string): Promise<void> {
    const library = this.libs.get(libId)
    if (!library) 
      throw new Error(`Library not found: ${libId}`)
    const docPath = path.join(library.path, docId);
    await window.fs.delete(docPath, true);
  }

  async deleteFolder(libId: string, folderId: string): Promise<void> {
    const library = this.libs.get(libId)
    if (!library) 
      throw new Error(`Library not found: ${libId}`)
    const folderPath = path.join(library.path, folderId);
    await window.fs.delete(folderPath, true);
  }

}

export const libraryStore = new LibraryStore()
