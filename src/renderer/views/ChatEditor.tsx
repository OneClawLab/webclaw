import clsx from 'clsx'
import { Logger, Assert } from '@lib/logast.js'
import { withLogging } from '@lib/renderer/withLogging.js'
import { useAppDispatch, useAppSelector } from '@state/storeHolder.js'

import React, { useEffect, useRef, useState } from 'react'
import { EditorView } from '@codemirror/view'
import { EditorContext, EditorContextValue } from '@editor/useEditorContext.js'
import { EditorToolbar } from '@renderer/components/EditorToolbar.js'
import { CodeMirrorEditor } from './CodeMirrorEditor.js'

import { TabStatus } from '@state/slices/tab/types.js'
import { tabActions } from '@state/slices/tab/slice.js'
import { selectTab } from '@state/slices/workspace/selectors.js'

import { theFocusManager } from '@view/index.js'

import { dispatchEditorCommand, getEditorCommand } from '@editor/commands/registry.js'
import { toast } from '@lib/renderer/dialog.js'
import { loadDoc } from '@editor/DocLoader.js'

interface Props {
  className?: string
  tabId: string         // 注：内部也使用此 tabId 直接作为 viewId
  docId: string         // 所编辑的文档ID, 见 workspace/doc/types.ts
  status: TabStatus
  autoScroll: boolean
  refresh: number       // 刷新信号, 每次变化时重新加载 chunk
}

// Editor的功能定位：
// 1. 包含两部分：编辑工具栏(EditorToolbar)和文档编辑器 (MirrorEditor)。
// 2. 负责加载和保存文档内容。
// 3. 负责提供 EditorContext，将编辑器状态(在MirrorEditor中)和命令(EditorToolbar中)连接起来。

function ChatEditorBase({ className, tabId, docId, status, autoScroll, refresh }: Props): React.JSX.Element {
  const appDispatch = useAppDispatch();

  const [doc, setDoc] = useState<{ content: string } | null>();
  const fileSignature = useRef<string | undefined >(undefined);
  const [view, setView] = useState<EditorView | null>(null);

  const tab = useAppSelector(selectTab(tabId))!;

  useEffect(() => {
    const asyncLoad = async () => {
      const result = await loadDoc(docId, fileSignature.current);
      if (result.status === 'not_found') {
        Logger.error('ChatEditor', `Document not found for docId: ${docId}, error: ${result.error}`);
        toast.show('Document not found.', 'error');
        setDoc({ content: '' });
        appDispatch(tabActions.updateTabStatus({ tabId, status: 'deleted' }));
        return;
      } else if (result.status === 'error') {
        Logger.error('ChatEditor', `Error loading document for docId: ${docId}, error: ${result.error}`);
        toast.show('Error loading document content.', 'error');
        setDoc({ content: '' });
        appDispatch(tabActions.updateTabStatus({ tabId, status: 'error' }));
        return;
      } else if (result.status === 'unchanged') {
        Logger.debug('ChatEditor', `Document ${docId} unchanged, using existing content.`);
        return;
      } else if (result.status === 'ok') {
         if (tab._dirty) {
          Logger.debug('ChatEditor', `Document ${docId} has unsaved changes in this tab, skipping reload.`);
          toast.show('Document has unsaved changes, reload skipped.', 'warn');
          appDispatch(tabActions.updateTabStatus({ tabId, status: 'outdated' }));
          return;
        } else {
          Logger.debug('ChatEditor', `Document ${docId} loaded successfully, updating content.`);
          setDoc({ content: result.content! });
          fileSignature.current = result.signature;
          appDispatch(tabActions.updateTabStatus({ tabId, status: 'normal' }));
          return;
        }
      }
    };
    asyncLoad();
    return () => {};
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId, tabId, refresh, setDoc, appDispatch]);

  // EditorContext的具体实现
  const contextValue: EditorContextValue = {
    docId,
    viewId: tabId, // 使用 tabId 作为 viewId
    view,
    runCommand: (id: string, args?: any) => {
      if (view) {
        Logger.debug('ChunkEditor', `Running command: ${id}`);
        dispatchEditorCommand(id, view, args);
        theFocusManager.restoreFocus();
      }
    },
    isCommandActive: (id: string) => {
      if (!view) return false;
      const cmd = getEditorCommand(id);
      return cmd && cmd.isActive ? cmd.isActive(view) : false;
    },
    isCommandEnabled: (id: string) => {
      if (!view) return false;
      const cmd = getEditorCommand(id);
      return cmd && cmd.isEnabled ? cmd.isEnabled(view) : false;
    },
  };

  return (
    <EditorContext.Provider value={contextValue}>
      <div
        id="ChatEditor"
        className={clsx('ChatEditor flex flex-col w-full h-full min-h-0', className)}
      >
        <EditorToolbar />
        {doc === null || doc === undefined ? (
          <div>Loading Document...</div>
        ) : (
          <>
            <CodeMirrorEditor
              key={docId + '-' + (fileSignature.current ?? '')}  // 当 docId 或 文件签名 变化时强制重载 Editor
              initialDoc={doc!.content}
              tabId={tabId}
              docId={docId}
              status={status}
              autoScroll={autoScroll}
              onReady={setView}
            />
          </>
        )}
      </div>
    </EditorContext.Provider>
  )
};

export const ChatEditor = withLogging(ChatEditorBase, { name: 'ChatEditor' });
