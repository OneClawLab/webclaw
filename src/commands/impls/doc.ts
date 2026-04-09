import { Logger, Assert } from '@lib/logast.js'
import { k18 } from '@lib/i18n.js';

import { defineCommand, defineCommandGroup, dispatchCommand } from '@commands/registry.js';
import { getAppDispatch } from '@state/storeHolder.js';

import { theDocManager } from '@editor/DocManager.js';
import { openDocumentAsync, saveDocumentAsync } from '@state/slices/doc/extraReducers.js';
import { tabActions } from '@state/slices/tab/slice.js';

defineCommandGroup({
  id: 'document',
  title: k18('commands.document.title'),
  commands: []
});

// Define commands for document operations

// 保存指定文档的内容
// closing: boolean 是否保存后关闭Tab，默认为 false
// tabId: string 指定是哪个 Tab 触发的保存操作，用于在保存后关闭 Tab
defineCommand<{ docId: string, closing?: boolean, tabId?: string }>({
  id: 'document/save',
  group: 'document',
  title: k18('commands.document.commands.saveDocument'),
  async run(args) {
    const docId = args.docId;
    if (!docId) {
      Logger.warn('No docId specified for document/save command');
      return
    }

    // 真正的文档内容在这里获取
    const es = theDocManager.getEditorStates(docId)[0];
    if (!es) {
      Logger.warn('No editor state found for document:', docId);
      return;
    }
    const content = es.doc.toString();
    Logger.debug('Saving document:', docId, 'Content length:', content.length);

    // 异步保存文档内容，并在保存完成后关闭 Tab（如果需要）
    const dispatch = getAppDispatch();
    await dispatch(saveDocumentAsync({ docId, content }));
    if (args.closing && args.tabId) // 如果需要关闭 Tab
      dispatch(tabActions.closeTab({ tabId: args.tabId, ignorePinned: true }));
    dispatchCommand('tree/node/syncToActiveTab', {});
  }
});

defineCommand<{void}>({
  id: 'document/open',
  group: 'document',
  title: k18('commands.document.commands.openDocument'),
  shortcut: 'Mod+O',
  async run(args) {
    const dispatch = getAppDispatch();
    await dispatch(openDocumentAsync());
  }
});

