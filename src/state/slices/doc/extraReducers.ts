import { Logger, Assert } from '@lib/logast.js'

import { createAsyncThunk } from '@reduxjs/toolkit'
import type { ActionReducerMapBuilder } from '@reduxjs/toolkit'

import { getState } from '@state/storeHolder.js'
import { DocState, ExternalDoc, LibraryDoc, UnsavedDoc } from './types.js'

import { libraryStore } from '@library/LibraryStore.js'
import { dispatchCommand } from '@commands/registry.js'
import { docActions } from './slice.js'
import { tabActions } from '../tab/slice.js'
import { DocUtils } from './utils.js'
import { treeActions } from '../tree/slice.js'
import { refreshLibraryAndTreeAsync } from '../workspace/extraReducers.js'
import { theDocManager } from '@editor/DocManager.js'

async function markTabsAsClean(docId: string, thunkAPI: any) {
  Logger.debug('docSlice', `Marking tabs as clean for docId: ${docId}`);
  await thunkAPI.dispatch(tabActions.markTabsDirtyForDoc({ docId, dirty: false }));
}

// Async thunk to open an external document
export const openDocumentAsync = createAsyncThunk(
  'document/open',
  async (_, thunkAPI) => {
    const filePaths = await window.ui.openFile({
      title: 'Open Document',
      allowMultiple: false,
      filters: [
        { name: 'Markdown Files', extensions: ['md', 'markdown', 'mdown', 'mkd', 'mdx'] },
        { name: 'Text Files', extensions: ['txt', 'text', 'log', 'csv', 'tsv'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (!filePaths || filePaths.length === 0) {
      Logger.debug('docSlice', 'openDocumentAsync cancelled by user');
      return thunkAPI.rejectWithValue('Cancelled');
    }

    const filePath = filePaths[0];
    const doc = DocUtils.createDocFromFilePath(filePath);
    thunkAPI.dispatch(docActions.addDoc({ doc }));

    const docId = DocUtils.docId(doc);
    await dispatchCommand('tab/open', { docId, switchTo: true, switchFocus: false });

    if (doc.origin === 'library') {
      // 刷新 该 lib, (以及 TreeView) (保证一下，万一这个文档外部生成后，TreeView还没及时更新进来)
      const libId = (doc as LibraryDoc).libId;
      await thunkAPI.dispatch(refreshLibraryAndTreeAsync({ libId })).unwrap();
      // 选中该 TreeNode，并让 TreeView 定位到该节点，节点ID为 lib 里的 相对 docId。
      const treeId = (doc as LibraryDoc).libId; // TreeId 就是 libId
      const nodeId = doc.docId;
      thunkAPI.dispatch(treeActions.setSelectedNodeIds({ treeId, nodeIds: [nodeId]}));
      thunkAPI.dispatch(treeActions.setFocusedNodeId({ treeId, nodeId, expandTo: true, makeVisible: true }));
    }

    return { docId };
  }
);

// Async thunk to save a document, could be: library/external/unsaved document
export const saveDocumentAsync = createAsyncThunk(
  'document/save',
  async ({ docId, content }: { docId: string; content: string }, thunkAPI) => {
    const state = getState();

    const doc = state.doc.docs[docId];
    if (!doc) {
      Logger.error('docSlice', 'Document not found in state:', docId);
      return thunkAPI.rejectWithValue(`Document not found: ${docId}`);
    }

    try {
      switch (doc.origin) {
        case 'library': {
          const libDoc = doc as LibraryDoc;

          await libraryStore.saveDocument(libDoc.libId, libDoc.docId, content);
          await markTabsAsClean(docId, thunkAPI);

          return { docId };
        }
        case 'external': {
          const externalDoc = doc as ExternalDoc;

          await window.fs.writeText(externalDoc.docPath, content);
          await markTabsAsClean(docId, thunkAPI);

          return { docId };
        }
        case 'unsaved': {
          const unsavedDoc = doc as UnsavedDoc;

          const filePath = await window.ui.saveFile({
            title: 'Save Document As',
            defaultPath: unsavedDoc.title,
            filters: [
              { name: 'Markdown Files', extensions: ['md', 'markdown', 'mdown', 'mkd', 'mdx'] },
              { name: 'Text Files', extensions: ['txt', 'text', 'log', 'csv', 'tsv'] },
              { name: 'All Files', extensions: ['*'] },
            ],
          });

          if (!filePath) {
            Logger.debug('docSlice', 'saveDocumentAsync cancelled by user for unsaved document:', docId);
            return thunkAPI.rejectWithValue('Cancelled');
          }

          await window.fs.writeText(filePath, content);

          const newDoc = DocUtils.createDocFromFilePath(filePath);
          thunkAPI.dispatch(docActions.updateDoc({ docId, doc: newDoc }));

          const newDocId = DocUtils.docId(newDoc);
          theDocManager.updateDocId(docId, newDocId);
          thunkAPI.dispatch(tabActions.updateTabsDocId({ oldDocId: docId, newDocId }));

          // 如果被保存为了 library 文档, 需要刷新库 和 TreeView
          if (newDoc.origin == 'library') {
            // 刷新 该 lib, (以及 TreeView)
            const libId = (newDoc as LibraryDoc).libId;
            await thunkAPI.dispatch(refreshLibraryAndTreeAsync({ libId })).unwrap();
            // 选中该 TreeNode，并让 TreeView 定位到该节点，节点ID为 lib 里的 相对 docId。
            const treeId = (newDoc as LibraryDoc).libId; // TreeId 就是 libId
            const nodeId = newDoc.docId;
            thunkAPI.dispatch(treeActions.setSelectedNodeIds({ treeId, nodeIds: [nodeId]}));
            thunkAPI.dispatch(treeActions.setFocusedNodeId({ treeId, nodeId, expandTo: true, makeVisible: true }));
          }

          await markTabsAsClean(newDocId, thunkAPI);

          return { newDocId };
        }
        default:
          throw new Error(`Unsupported document type: ${doc.origin}`);
      }
    } catch (error) {
      Logger.error('docSlice', `Failed to save document: ${error}`);
      return thunkAPI.rejectWithValue(`Failed to save document: ${error}`);
    }
  }
);

export function buildExtraReducers(builder: ActionReducerMapBuilder<DocState>) {
  builder  
  // openDocumentAsync
    .addCase(openDocumentAsync.pending, (state, action) => {
      // nothing to do
    })
    .addCase(openDocumentAsync.fulfilled, (state, action) => {
      // nothing to do
    })
    .addCase(openDocumentAsync.rejected, (state, action) => {
      if (action.payload === 'Cancelled')
        Logger.info('docSlice', 'Document open cancelled by user')
      else
        Logger.error('docSlice', 'Failed to open document for workspace: ', action.payload)
    })
  // saveDocumentAsync
    .addCase(saveDocumentAsync.pending, (state, action) => {
      // nothing to do
    })
    .addCase(saveDocumentAsync.fulfilled, (state, action) => {
      Logger.info('docSlice', 'Document saved successfully:', action.meta.arg.docId);      
    })
    .addCase(saveDocumentAsync.rejected, (state, action) => {
      if (action.payload === 'Cancelled')
        Logger.info('docSlice', 'Document save cancelled by user')
      else
        Logger.error('docSlice', 'Failed to save document for workspace: ', action.payload)
    })
}
