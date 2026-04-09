import React, { useEffect, useRef } from 'react'
import { withLogging } from '@lib/renderer/withLogging.js'
import { ResizablePanel } from './ResizablePanel.js'
import { OutlineView } from '@renderer/layout/OutlineView.js'
import { WelcomeView } from '@renderer/views/WelcomeView.js'
import { TabArea } from '@renderer/views/TabArea.js'
import { SidePanel } from '@renderer/views/SidePanel.js'
import { uiActions } from '@state/slices/ui/slice.js';
import { tabActions } from '@state/slices/tab/slice.js'
import { useAppDispatch, useAppSelector } from '@state/storeHolder.js'
import { dispatchEditorCommand } from '@editor/commands/registry.js'
import { theDocManager } from '@editor/DocManager.js'
import { ChatSectionUtils } from '@editor/ChatSectionUtils.js'
import { Logger } from '@lib/logger.js'

// WorkspaceView 由三部分组成：OutlineView / (TabArea/WelcomeView) / SidePanel
function WorkspaceViewBase(): React.JSX.Element {
  const dispatch = useAppDispatch()
  const tabs = useAppSelector((state) => state.tab.tabs)
  const layout = useAppSelector((state) => state.ui.layout)

  const { outlineWidth, outlineCollapsed, sidePanelWidth, sidePanelCollapsed,
    isOutlineViewVisible, isTabAreaVisible, isSidePanelVisible } = layout;

  //>>> 以下为 所有 Tab里的 auto commit 相关逻辑，集中在 (永远都在的) WorkspaceView 里管理。
  // 设计如下:  
  // - 当 autoCommit 启用(正整数) 且 editing 从 true 变 false 时，以及文档末尾有一个非空的Q区块的时候，启动定时器
  // - 定时器到时后，执行自动提交命令
  // - 在定时器运行期间，每秒切换 highlight 状态以实现闪烁效果
  // - 用户按下 ESC 键可以取消自动提交，清除定时器和高亮状态
  // - 如果 editing 再次变为 true，则取消自动提交，清除定时器和高亮状态

  // 用 Map 管理每个 tab 的定时器和闪烁
  const timersRef = useRef<Map<string, {
    timer: NodeJS.Timeout | null,
    blink: NodeJS.Timeout | null,
    blinkState: boolean
  }>>(new Map());

  // 用 Map 记录每个 tab 的上一次 editing 状态
  const lastEditingRef = useRef<Map<string, boolean>>(new Map());

  useEffect(() => {
    // 监听 ESC，取消所有等待中的 auto commit
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && timersRef.current.size > 0) {
        Logger.debug('WorkspaceView', `ESC pressed, cancelling all ${timersRef.current.size} auto commits`);
        timersRef.current.forEach((obj, tabId) => {
          if (obj.timer) clearTimeout(obj.timer);
          if (obj.blink) clearInterval(obj.blink);
          dispatch(tabActions.markTabHighlight({ tabId, highlight: false }));
        });
        timersRef.current.clear();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dispatch])

  useEffect(() => {
    const timers = timersRef.current;
    const lastEditing = lastEditingRef.current;

    // Tab已被关闭时，从 lastEditing map 中清理掉，以及从 timers map 中清理掉
    const tabIds = new Set(tabs.map(t => t.id));
    Array.from(lastEditing.keys()).forEach(tabId => {
      if (tabIds.has(tabId)) return;
      lastEditing.delete(tabId);
    });
    Array.from(timers.keys()).forEach(tabId => {
      if (tabIds.has(tabId)) return;
      Logger.debug('WorkspaceView', `Tab ${tabId} has been closed, clearing its auto commit timers`);
      const obj = timers.get(tabId)!;
      if (obj.timer) clearTimeout(obj.timer);
      if (obj.blink) clearInterval(obj.blink);
      timers.delete(tabId);
    });

    // 对于 auto commit 没开启的 Tabs，或者 开启了但正在被编辑的 Tabs，清理掉已注册的定时器
    const notAutoCommitOrEditingTabs = tabs.filter(tab => !(tab.meta?.autoCommit ?? 0) || (tab._editing ?? false));
    notAutoCommitOrEditingTabs.forEach(tab => {
      const tabId = tab.id;
      if (timers.has(tabId)) {
        Logger.debug('WorkspaceView', `Clearing auto commit for tab ${tabId}, due to: (autoCommit = ${tab.meta?.autoCommit ?? 0}, editing = ${tab._editing ?? false})`);
        const obj = timers.get(tabId)!;
        if (obj.timer) clearTimeout(obj.timer);
        if (obj.blink) clearInterval(obj.blink);
        dispatch(tabActions.markTabHighlight({ tabId, highlight: false }));
        timers.delete(tabId);
      }
    });

    // 对于 开启了 auto commit 且 Editing 从true变false的 Tabs，启动定时器
    const autoCommitAndEditingFellTabs = 
      tabs.filter(tab => (tab.meta?.autoCommit ?? 0) > 0 && 
                         (lastEditing.get(tab.id) === true && !(tab._editing ?? false)));
    autoCommitAndEditingFellTabs.forEach(tab => {
      const tabId = tab.id;

      // 检查文档末尾是否有非空的Q区块，如果没有则不启动
      const view = theDocManager.getEditorView(tabId)!;
      const lastCS = ChatSectionUtils.getLastChatSection(view.state);
      if (!(lastCS && lastCS.type === 'question' && lastCS.textFrom < lastCS.textTo)) {
        Logger.debug('WorkspaceView', `Not starting auto commit for tab ${tabId}, because last chat section is not a non-empty question block`);
        return;
      }

      /// 开始Tab标题闪烁和延迟提交定时器
      const autoCommit = tab.meta?.autoCommit ?? 0;
      Logger.debug('WorkspaceView', `Starting auto commit for tab ${tabId} in ${autoCommit} seconds`);

      // 启动Tab标题闪烁
      dispatch(tabActions.markTabHighlight({ tabId, highlight: true }));
      let blinkState = true;
      const blink = setInterval(() => {
        blinkState = !blinkState;
        dispatch(tabActions.markTabHighlight({ tabId, highlight: blinkState }));
      }, 1000);

      // 启动延迟提交定时器
      const timer = setTimeout(() => {
        // 定时器到时后，清理闪烁和定时器
        clearInterval(blink);
        dispatch(tabActions.markTabHighlight({ tabId, highlight: false }));
        timersRef.current.delete(tabId);
        // 在Tab对应的EditorView里，执行 ask ai 命令
        Logger.debug('WorkspaceView', `Auto commit timer fired for tab ${tabId}, dispatching editor/ai/ask command`);
        const view = theDocManager.getEditorView(tabId)!;
        dispatchEditorCommand('editor/ai/ask', view, {});
      }, autoCommit * 1000);
      timers.set(tabId, { timer, blink, blinkState });
    });

    // 更新 所有 Tabs 的 lastEditing 状态
    tabs.forEach(tab => lastEditing.set(tab.id, tab._editing ?? false));
  }, [tabs, dispatch]);

  // --- auto commit 相关逻辑结束 ---

  return (
    // flex横向布局(flex flex-row)，宽度/高度 撑满父容器
    <div id="WorkspaceView" className="flex flex-row flex-1 min-w-0 min-h-0 bg-white">
      {(isOutlineViewVisible || isTabAreaVisible) && (
        <div id="MainContent" className="flex flex-row min-w-0 min-h-0 flex-1">
          {isOutlineViewVisible && (
            <ResizablePanel
              direction="horizontal"
              handlePosition="end"
              initialSize={outlineCollapsed ? 0 : outlineWidth}
              minSize={outlineCollapsed ? 0 : 150}
              maxSize={400}
              collapsedSize={0}
              collapsible
              className="shrink-0"
              onResize={(size) => dispatch(uiActions.setOutlineWidth(size))}
              onCollapseChange={(collapsed) => dispatch(uiActions.setOutlineCollapsed(collapsed))}
              collapsed={outlineCollapsed}
            >
              <OutlineView />
            </ResizablePanel>
          )}

          <div id="TabAreaWrapper" className="flex-1 min-w-0 min-h-0 overflow-hidden">
            {(tabs.length === 0 || !isTabAreaVisible)
              ? <WelcomeView />
              : <TabArea />}
          </div>
        </div>
      )}

      {isSidePanelVisible && (
        <ResizablePanel
          direction="horizontal"
          handlePosition="start"
          initialSize={sidePanelCollapsed ? 0 : sidePanelWidth}
          minSize={sidePanelCollapsed ? 0 : 200}
          maxSize={600}
          collapsedSize={0}
          collapsible
          className="shrink-0"
          onResize={(size) => dispatch(uiActions.setSidePanelWidth(size))}
          onCollapseChange={(collapsed) => dispatch(uiActions.setSidePanelCollapsed(collapsed))}
          collapsed={sidePanelCollapsed}
        >
          <SidePanel />
        </ResizablePanel>
      )}
    </div>
  )
}

export const WorkspaceView = withLogging(WorkspaceViewBase, { name: 'WorkspaceView' });
