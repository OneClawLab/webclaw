import { Logger, Assert } from '@lib/logast.js'
import { withLogging } from '@lib/renderer/withLogging.js'
import { useDebugRender } from '@lib/renderer/useDebugRender.js'
import { useCallback, useEffect, useRef, useMemo, useState } from 'react'

import { EditorView, ViewUpdate } from '@codemirror/view'
import { EditorState, Extension } from '@codemirror/state'

import { runtimeActions } from '@state/slices/runtime/slice.js'
import { useTabDirtyTracker } from '../components/useTabDirtyTracker.js'
import { TabStatus } from '@state/slices/tab/types.js'
import { getState, useAppDispatch, useAppSelector } from '@state/storeHolder.js'
import { theDocManager } from '@editor/DocManager.js'

import { theFocusManager, theViewManager } from '@view/index.js'

// 我们的CodeMirror自定义配置
import { basicSetup } from '@editor/basicCodeMirror.js'

import { isEqualRuntimeState, RuntimeState } from '@state/slices/runtime/types.js'
import { DocAppender } from '@editor/DocAppender.js'
import { emitAppEvent } from '@event/app.js'
import { tabActions } from '@state/slices/tab/slice.js'
import { debounce, DEBOUNCE_SILENT_SAVE } from '@lib/debounce.js'

type Props = {
  initialDoc: string,
  tabId: string, // 注：内部也使用此 tabId 直接作为 viewId
  docId: string,
  status: TabStatus,
  autoScroll: boolean,

  // 当View初始化完成时调用，参数为初始化后的EditorView
  onReady: (view: EditorView) => void; 
}

function CodeMirrorEditorBase({ initialDoc, tabId, docId, status, autoScroll, onReady }: Props): React.JSX.Element {
  //useDebugRender('CodeMirrorEditor', { initialDoc, tabId, libId, docId, status, onReady });

  const appDispatch = useAppDispatch();
  const activeTabId = useAppSelector(state => state.tab.activeTabId);
  const editable = (status === 'normal');

  const [editorView, setEditorView] = useState<EditorView | null>(null);
  const refEditorView = useRef<EditorView | null>(null);
  useEffect(() => { refEditorView.current = editorView; }, [editorView]);

  const { markDirtyTrueDebounced } = useTabDirtyTracker(docId);

  // -------------  AutoScroll 相关逻辑

  // 保存 autoScroll 最新值
  const autoScrollRef = useRef(autoScroll);
  useEffect(() => {
    autoScrollRef.current = autoScroll;
  }, [autoScroll]);

  const doAutoScroll = useCallback((view: EditorView) => {
    if (!view) return;
    requestAnimationFrame(() => {
      // 保证选区(或光标)可见的情况下，尽量显示更多后面的内容
      DocAppender.scrollToVisible(view, view.state.selection.main.from, view.state.doc.length);
    });
  }, []);

  // -------------  Selection 相关信息同步

  const debouncedUpdateTabViewState = useRef<((tabId: string, rs: RuntimeState) => void) | null>(null);
  if (debouncedUpdateTabViewState.current === null) {
    debouncedUpdateTabViewState.current = debounce((tabId: string, rs: RuntimeState) => {
      appDispatch(tabActions.updateTabViewState({ tabId, viewState: rs }));
    }, ...DEBOUNCE_SILENT_SAVE);
  }

  const refLastRS = useRef<RuntimeState | null>(null);
  const onEditorViewUpdated = useCallback((update: ViewUpdate) => {
    const newState = update.state;

    if (update.docChanged) {
      markDirtyTrueDebounced();
      if (refEditorView.current && autoScrollRef.current)
        doAutoScroll(refEditorView.current);
    }

    const rs: RuntimeState = refLastRS.current ? { ...refLastRS.current } : {
      selection: { from: 0, to: 0, total: 0 },
      cursor: { line: 1, col: 1 },
      scrollTop: 0,
    };

    if (update.selectionSet) {
      const { from, to } = newState.selection.main;
      const total = newState.doc.length;
      const line = newState.doc.lineAt(from).number; // 1-based
      const col = from - newState.doc.line(line).from + 1;

      rs.selection = { from, to, total };
      rs.cursor = { line, col };
    }

    rs.scrollTop = refEditorView.current ? refEditorView.current.scrollDOM.scrollTop : refLastRS.current?.scrollTop || 0;

    if (refLastRS.current && isEqualRuntimeState(refLastRS.current, rs))
      return;

    // 及时更新到 runtime slice, (用以在 status bar显示)
    refLastRS.current = rs;
    appDispatch(runtimeActions.set(rs));

    // lazy 更新到 tab view state (用以持久化)
    if (debouncedUpdateTabViewState.current)
      debouncedUpdateTabViewState.current(tabId, rs);
  }, [tabId, appDispatch, doAutoScroll, markDirtyTrueDebounced]);

  // 切换activeTab时，恢复runtimeActions里的信息
  useEffect(() => {
    if (tabId === activeTabId && refEditorView.current) {
      if (refLastRS.current)
        appDispatch(runtimeActions.set(refLastRS.current));
    }
  }, [activeTabId, appDispatch, tabId]);

  // -------------  EditorView 的创建和销毁

  const onRestoreFocus = useCallback(() => {
    // 此处不要判断 refEditorView.current 是否存在，因为有可能在EditorView创建时就调用了此函数。
    // Logger.debug('CodeMirrorEditor', 'Restoring focus to EditorView');
    setTimeout(() => { refEditorView.current?.focus(); }, 10);
  }, []);

  const onFocused = useCallback(() => {
    //Logger.debug('useCodeMirror', 'EditorView focused');
    theFocusManager.onFocused('EditorView', tabId);
  }, [tabId]);

  const onKeydown = useCallback((e: KeyboardEvent) => {
    // 任何键盘操作都禁用 autoScroll
    if (autoScrollRef.current)
      autoScrollRef.current = false;
  }, []);

  // 1. 点击时 自动禁掉 autoScroll 效果，避免跳动
  // 2. 点击编辑器有效文本后的空白处，自动将光标移动到文档末尾
  const onMouseDown = useCallback((e) => {
    // 排除点击 CodeMirror UI 组件（如搜索面板）的情况
    const target = e.target as HTMLElement;
    if (target.closest('.cm-panel') || target.closest('.cm-button')) {
      return; // 不处理面板内的点击，让面板自己处理事件
    }

    // 1. 任何鼠标点击都禁用 autoScroll
    // 只改变本地值，让滚动失效即可。tab的自动滚动状态还是外部控制。
    if (autoScrollRef.current)
      autoScrollRef.current = false;

    // 2. 点击有效文本后的空白处，移动光标到末尾

    if (e.button !== 0) return // 只处理左键
    const view = refEditorView.current;
    if (!view) return;

    const eof = view.state.doc.length;
    const endCoords = view.coordsAtPos(eof);
    const rect = view.dom.getBoundingClientRect();

    // 如果最后一行可视坐标不可用，用 rect.bottom
    const lastLineBottom = endCoords ? endCoords.bottom : rect.bottom;

    // 点击在编辑器下半部分空白
    if (e.clientY > lastLineBottom) {
      e.preventDefault();
      view.dispatch({ selection: { anchor: eof }, scrollIntoView: true });
      view.focus();
    }
  }, []);

  const extensions = useMemo<Extension[]>(() => {
    return [
      basicSetup,
      EditorView.editable.of(editable),
      EditorView.updateListener.of((update) => { onEditorViewUpdated(update) }),
    ];
  }, [editable, onEditorViewUpdated]);

  // 当挂载到DOM节点时，初始化 EditorView
  const refContainer = useCallback((container: HTMLDivElement | null) => {
    if (!container || refEditorView.current) {
      //Logger.debug('useCodeMirror', `${editorViewRef.current ? 'Already has EditorView' : 'No container yet'}`);
      return;
    }
    Logger.debug('useCodeMirror', 'Initializing EditorState and EditorView');

    const state = EditorState.create({ doc: initialDoc, extensions });
    const view = new EditorView({
      state, parent: container,
      dispatchTransactions: (trs) => {
        view.update(trs);
        theDocManager.onTransactionsApplied(docId, view, trs);
      }
    });

    // 恢复 RuntimeState
    const tab = getState().tab.tabs.find(t => t.id === tabId);
    const savedRS = tab?.viewState || null;
    if (savedRS) {
      const sel = savedRS.selection;
      if (sel) {
        const eof = view.state.doc.length;
        const anchor = Math.min(sel.from, eof);
        const head = Math.min(sel.to, eof);
        view.dispatch({ selection: { anchor, head }, scrollIntoView: true });
      }
      // 延迟设置 scrollTop
      setTimeout(() => {
        if (savedRS.scrollTop && refEditorView.current)
          refEditorView.current.scrollDOM.scrollTop = savedRS.scrollTop;
      }, 20);
    }

    view.dom.addEventListener("mousedown", onMouseDown);
    view.dom.addEventListener("keydown", onKeydown);

    // 这里用 focusin 事件，因为 focus 事件不会冒泡。
    // 我们这里只是监听container的事件，如果不冒泡意味着子节点获得focus后不会发事件给父container。
    view.dom.addEventListener('focusin', onFocused);
    setEditorView(view);

    theDocManager.onCreated(docId, tabId, view);
    theViewManager.onCreated('EditorView', tabId, {
      focus: onRestoreFocus,
    });
    emitAppEvent('editor:created', { docId, tabId });

    onReady(view);
  }, [initialDoc, docId, tabId, extensions, onKeydown, onMouseDown, onFocused, onReady, onRestoreFocus]);

  // 当从DOM节点卸载时，销毁 EditorView
  useEffect(() => {
    return () => {
      if (!refEditorView.current)
        return;
      Logger.debug('useCodeMirror', 'Destroying EditorView');

      emitAppEvent('editor:destroyed', { docId, tabId });
      theDocManager.onDestroyed(docId, tabId, refEditorView.current);
      theViewManager.onDestroyed('EditorView', tabId);

      refEditorView.current.dom.removeEventListener('focusin', onFocused);
      refEditorView.current.destroy();
      setEditorView(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div id="CodeMirrorEditor" data-tab-id={tabId} ref={refContainer} className="CodeMirrorEditor gap-4 flex-1 min-h-0 overflow-hidden" />
  );
}

export const CodeMirrorEditor = withLogging(CodeMirrorEditorBase, { name: 'CodeMirrorEditor' });
