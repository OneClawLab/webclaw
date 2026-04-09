import { Logger } from '@lib/logast.js';
import React, { useEffect, useRef, useState } from 'react';
import { ErrorBoundary } from '@lib/renderer/ErrorBoundary.js'
import { withLogging } from '@lib/renderer/withLogging.js'
import { LucideIcon } from '@lib/renderer/LucideIcon.js'
import { useTranslation } from '@lib/renderer/useTranslation.js'

import { getAppDispatch, useAppSelector } from '@state/storeHolder.js'

import { ChatEditor } from './ChatEditor.js'
import { TabAreaMADM } from '../dropdowns/TabAreaMADM.js'
import { TabHandle } from '../components/TabHandle.js'
import { tabActions } from '@state/slices/tab/slice.js';
import { dispatchAppCommand } from '@commands/registry.js';

// TabArea 负责管理和展示多标签页编辑器区域，是主内容区的核心容器。
// 其布局分为两层：
// 1. 顶部 TabBar 区域，包含若干Tab页签(TabHandles)，操作有切换/关闭/固定等，以及右侧的 TabActions 操作按钮区。
// 2. 下方 EditorWrapper 区域，根据当前激活的标签页，渲染对应的编辑器组件(每页都有独立的一个ChatEditor组件，但只有当前页是可见的）。
// 该组件与全局状态（tabs、activeTabId）联动，实现多标签页的切换与管理。

type TabActionsProps = {
  activeTabId?: string
};

// TabActions指 tabs页签区域 右侧的 操作按钮区域
function TabActions({ activeTabId }: TabActionsProps): React.JSX.Element {
  return (
    <div id='TabActions' className="flex items-center space-x-2 pr-2">
      <button className="p-1 hover:bg-gray-200 rounded">
        <LucideIcon name="Info" size={16} />
      </button>
      <TabAreaMADM />
    </div>
  )
}

function TabAreaBase(): React.JSX.Element {
  const { t } = useTranslation();
  const tabs = useAppSelector((state) => state.tab.tabs)
  const activeTabId = useAppSelector((state) => state.tab.activeTabId);
  const tabHandlesRef = useRef<HTMLDivElement>(null);
  const [isScrollable, setIsScrollable] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [shakeLeft, setShakeLeft] = useState(false);
  const [shakeRight, setShakeRight] = useState(false);
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 被拖拽的Tab ID
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  // 目标放置的Tab ID
  const [targetTabId, setTargetTabId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, tabId: string) => {
    setDraggedTabId(tabId);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, tabId: string) => {
    e.preventDefault();
    setTargetTabId(tabId);
  };

  const handleDrop = (e: React.DragEvent, tabId: string) => {
    const draggedIndex = tabs.findIndex((tab) => tab.id === draggedTabId);
    const targetIndex = tabs.findIndex((tab) => tab.id === targetTabId);

    if (draggedIndex !== -1 && targetIndex !== -1 && draggedIndex !== targetIndex) {
      Logger.debug('TabArea', `Moving tab ${draggedTabId} to index ${targetIndex}`);
      const dispatch = getAppDispatch();
      dispatch(tabActions.moveTab({ tabId: draggedTabId!, toIndex: targetIndex }));
    }

    setDraggedTabId(null);
    setTargetTabId(null);
  };

  useEffect(() => {
    const tabHandles = tabHandlesRef.current;
    if (!tabHandles) return;

    const updateScrollable = () => {
      const { scrollWidth, clientWidth, scrollLeft } = tabHandles;
      setIsScrollable(scrollWidth > clientWidth);
      setCanScrollLeft(scrollLeft > 5);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 5);
    };

    updateScrollable();
    window.addEventListener('resize', updateScrollable);
    tabHandles.addEventListener('scroll', updateScrollable);

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const scrollSpeedMultiplier = 5;
      tabHandles.scrollLeft += event.deltaY * scrollSpeedMultiplier;
    };

    tabHandles.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      tabHandles.removeEventListener('wheel', handleWheel);
      tabHandles.removeEventListener('scroll', updateScrollable);
      window.removeEventListener('resize', updateScrollable);
    };
  }, [tabs]);

  useEffect(() => {
    if (!tabHandlesRef.current || !activeTabId) return;

    const activeTabElement = tabHandlesRef.current.querySelector<HTMLDivElement>(
      `[data-tab-id="${activeTabId}"]`
    );

    if (activeTabElement) {
      activeTabElement.scrollIntoView({
        behavior: 'instant',
        block: 'nearest',
        inline: 'nearest',
      });
    }
  }, [activeTabId]);

  const startScrolling = (direction: 'left' | 'right') => {
    if (!tabHandlesRef.current) return;
    const scrollStep = direction === 'left' ? -2 : 2;
    scrollIntervalRef.current = setInterval(() => {
      tabHandlesRef.current!.scrollLeft += scrollStep;
    }, 10);
  };

  const stopScrolling = () => {
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
  };

  const handleClickScroll = (direction: 'left' | 'right') => {
    stopScrolling();
    const el = tabHandlesRef.current;
    if (!el) return;

    const before = el.scrollLeft;
    if (direction === 'left') el.scrollLeft -= 300;
    else el.scrollLeft += 300;

    setTimeout(() => {
      const after = el.scrollLeft;
      if (before === after) {
        direction === 'left' ? setShakeLeft(true) : setShakeRight(true);
        setTimeout(() => direction === 'left' ? setShakeLeft(false) : setShakeRight(false), 250);
      }
    }, 200);
  };

  return (
    <main id="TabArea" className="flex-1 flex flex-col min-w-0 min-h-0 h-full overflow-hidden">
      {/* 页签区，包括：多个TabHandle，右侧为TabActions区域 */}
      <div id="TabBar" className="flex items-center relative justify-between">
        {/* 左右按钮和TabHandles的容器 */}
        <div
          id="TabHandlesWrapper"
          className={`flex items-center relative overflow-hidden grow group transition-all duration-300
            ${canScrollLeft ? 'has-left' : ''} ${canScrollRight ? 'has-right' : ''}`}
        >
          {/* 左侧浮动按钮 */}
          {isScrollable && (
            <button
              id="ScrollLeftButton"
              className={`ScrollButton left-0 hidden group-hover:flex items-center justify-center absolute z-10 transition-all
                ${canScrollLeft ? 'animate-[pulseGlow_1.5s_ease-in-out_infinite]' : ''}
                ${shakeLeft ? 'animate-[shakeX_0.25s_ease-in-out]' : ''}`}
              onClick={() => handleClickScroll('left')}
              onMouseEnter={() => startScrolling('left')}
              onMouseLeave={stopScrolling}
            >
              <LucideIcon name="ChevronLeft" size={16} />
            </button>
          )}

          {/* 渐变遮罩 */}
          <div className={`TabHandlesEdgeFade Left left-0 ${canScrollLeft ? 'Visible' : ''}`} />

          {/* 多个TabHandle */}
          <div
            id="TabHandles"
            ref={tabHandlesRef}
            className="flex flex-row overflow-x-hidden hover:overflow-x-auto min-w-0 scroll-smooth"
          >
            {tabs.map((tab) => (
              <div key={tab.id} data-tab-id={tab.id}
                className={`${tab.id == targetTabId ? 'DraggingOver' : '' }`}
                draggable 
                onDragStart={(e) => handleDragStart(e, tab.id)} 
                onDragOver={(e) => handleDragOver(e, tab.id)}
                onDrop={(e) => handleDrop(e, tab.id)}
              >
                <TabHandle key={tab.id} tab={tab} activeTabId={activeTabId} />
              </div>
            ))}
          </div>

          {/* 最右侧的新Tab按钮 */}
          <button
            id="NewTabButton"
            className={`NewTabButton flex items-center justify-center`}
            onClick={() => dispatchAppCommand('tab/new', {})}
          >
            <LucideIcon name="Plus" size={16} />
          </button>
          <label className="min-w-8"></label>

          {/* 渐变遮罩 */}
          <div className={`TabHandlesEdgeFade Right right-0 ${canScrollRight ? 'Visible' : ''}`} />

          {/* 右侧浮动按钮 */}
          {isScrollable && (
            <button
              id="ScrollRightButton"
              className={`ScrollButton right-0 hidden group-hover:flex items-center justify-center absolute z-10 transition-all
                ${canScrollRight ? 'animate-[pulseGlow_1.5s_ease-in-out_infinite]' : ''}
                ${shakeRight ? 'animate-[shakeX_0.25s_ease-in-out]' : ''}`}
              onClick={() => handleClickScroll('right')}
              onMouseEnter={() => startScrolling('right')}
              onMouseLeave={stopScrolling}
            >
              <LucideIcon name="ChevronRight" size={16} />
            </button>
          )}
        </div>

        {/* TabActions区域，即最右侧的若干按钮 */}
        <div id="TabActionsWrapper" className="flex items-center space-x-2 pr-2">
          <TabActions activeTabId={activeTabId} />
        </div>
      </div>

      {/* 编辑器区，包括 EditorToolbar 和 CodeMirrorEditor */}
      <div id="EditorWrapper" className="flex-1 min-h-0">
        <ErrorBoundary
          fallback={<div>{t('errors.general.reactComponentError')}</div>}
          onError={(error, info) => { console.error('Logging error:', error, info); }}
        >
          {tabs.map((tab) => (
            <div key={tab.id} className={`EditorTabWrapper flex w-full h-full
              ${tab.id === activeTabId ? 'Active' : 'Hidden'}`}
            >
              <ChatEditor
                className="flex-1 min-h-0"
                tabId={tab.id} docId={tab.docId} refresh={tab._refresh || 0} status={tab.status} autoScroll={tab._autoScroll || false}
              />
            </div>
          ))}
        </ErrorBoundary>
      </div>
    </main>
  );
}

export const TabArea = withLogging(TabAreaBase, { name: 'TabArea' });
