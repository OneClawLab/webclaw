import { path } from "@lib/path.js";
import { Doc, DocId, DocOrigin, ExternalDoc, LibraryDoc, UnsavedDoc } from "./types.js";
import { getState } from "@state/storeHolder.js";
import { Library } from "../lib/types.js";

export const DocUtils = {

  // 获取 Document 的唯一标识符
  docId(doc: Doc): DocId {
    switch (doc.origin) {
      case 'library': {
        const libDoc = doc as LibraryDoc;
        return `library/${libDoc.libId}/${libDoc.docId}`;
      }
      case 'external': {
        const extDoc = doc as ExternalDoc;
        return `external/${extDoc.docPath}`;
      }
      case 'unsaved': {
        const unsavedDoc = doc as UnsavedDoc;
        return `unsaved/${unsavedDoc.tmpId}`;
      }
      default:
        return 'Unknown';
    }
  },

  // 根据参数创建 Document 的唯一标识符
  makeDocId(origin: DocOrigin, args: object): DocId {
    switch (origin) {
      case 'library': {
        const libDoc = args as { libId: string, docId: string };
        return `library/${libDoc.libId}/${libDoc.docId}`;
      }
      case 'external': {
        const extDoc = args as { docPath: string };
        return `external/${extDoc.docPath}`;
      }
      case 'unsaved': {
        const unsavedDoc = args as { tmpId: string };
        return `unsaved/${unsavedDoc.tmpId}`;
      }
      default:
        return 'Unknown';
    }
  },

  // 根据 docId 推断 Document 的来源类型
  docOrigin(docId: DocId): DocOrigin {
    if (docId.startsWith('library/')) {
      return 'library';
    } else if (docId.startsWith('external/')) {
      return 'external';
    } else if (docId.startsWith('unsaved/')) {
      return 'unsaved';
    } else {
      throw new Error(`Invalid docId format: ${docId}`);
    }
  },

  // 获取 Document 的文件系统全路径（如果有的话）
  docPath(docOrId: Doc | DocId): string | undefined {
    let doc: Doc;
    if (typeof docOrId === 'string') {
      doc = DocUtils.getDocById(docOrId)!;
    } else {
      doc = docOrId;
    }

    switch (doc.origin) {
      case 'library': {
        const libDoc = doc as LibraryDoc;
        return libDoc.docPath;
      }
      case 'external': {
        const extDoc = doc as ExternalDoc;
        return extDoc.docPath;
      }
      case 'unsaved': {
        return undefined;
      }
      default:
        return undefined;
    }
  },

  // 根据 Library Doc 的 ID 获取对应的 @链接字符串
  getAtLinkByLibraryDocId(docId: DocId): string | undefined {
    const doc = DocUtils.getDocById(docId);
    if (!doc)
      return undefined;
    if (doc.origin !== 'library')
      return undefined;

    // AtLink的格式: @kb/${libMeta.name}/{docId}
    const libDoc = doc as LibraryDoc;
    const libMeta = getState().lib.libs[libDoc.libId]?.meta;
    if (!libMeta)
      return undefined;
    return `@kb/${libMeta.name}/${libDoc.docId}`;
  },

  // 根据 docId 获取 存在于 docSlice 状态里的 Doc 对象
  getDocById(docId: DocId): 
    LibraryDoc | ExternalDoc | UnsavedDoc | undefined {
    const docs = getState().doc.docs;
    const doc = docs[docId];

    if (!doc)
      return undefined;
    if (doc.origin === 'library') {
      return doc as LibraryDoc;
    } else if (doc.origin === 'external') {
      return doc as ExternalDoc;
    } else if (doc.origin === 'unsaved') {
      return doc as UnsavedDoc;
    } else {
      return undefined;
    }
  },

  // 更改 LibraryDoc 的 docId（通常用于重命名场景），返回一个新 Doc 对象
  changeLibraryDocId(oldDoc: LibraryDoc, newDocId: DocId): LibraryDoc {
    const parts = newDocId.split('/');
    const libId = parts[1];
    const docId = parts.slice(2).join('/');

    const newDocPath = getState().lib.libs[libId]?.libPath
      ? path.join(getState().lib.libs[libId].libPath!, docId)
      : oldDoc.docPath;

    return {
      origin: 'library',
      libId,
      docId,
      docPath: newDocPath,
      title: DocUtils.extractDocTitleFromId(newDocId),
    };
  },

  // 从 docId 中提取文档标题, 即最后一部分的文件名的部分
  extractDocTitleFromId(docId: DocId): string {
    return path.basename(docId, '.md');
  },

  getDocs(origin?: DocOrigin): Doc[] {
    const docs = getState().doc.docs;
    if (!origin)
      return Object.values(docs);
    else
      return Object.values(docs).filter(doc => doc.origin === origin);  
  },

  getLibraryDocs(): LibraryDoc[] { return DocUtils.getDocs('library') as LibraryDoc[]; },
  getExternalDocs(): ExternalDoc[] { return DocUtils.getDocs('external') as ExternalDoc[]; },
  getUnsavedDocs(): UnsavedDoc[] { return DocUtils.getDocs('unsaved') as UnsavedDoc[] ; },

  // 根据文件路径创建合适的 Document（LibraryDoc 或 ExternalDoc）
  createDocFromFilePath(filePath: string): LibraryDoc | ExternalDoc {
    const state = getState();
    const libs = state.lib.libs;

    for (const libId in libs) {
      const lib = libs[libId];
      if (filePath.startsWith(lib.libPath!))
        return DocUtils.createLibraryDoc(filePath, lib);
    }
    return DocUtils.createExternalDoc(filePath);
  },

  // Helper function to create a LibraryDoc
  // Assumes filePath is within the library's path
  createLibraryDoc(filePath: string, lib: Library): LibraryDoc {
    return {
      origin: 'library',
      libId: lib.meta!.id,
      docId: path.relative(lib.libPath!, filePath),
      docPath: filePath,
      title: path.basename(filePath),
    };
  },

  // Helper function to create an ExternalDoc
  createExternalDoc(filePath: string): ExternalDoc {
    return {
      origin: 'external',
      title: path.basename(filePath),
      docPath: filePath,
    };
  },

};
