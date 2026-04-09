import React from 'react';
import { useAppSelector } from '@state/storeHolder.js';

import { NavBar } from '@renderer/components/NavBar.js';
import { ClientContent } from './ClientContent.js';
import { withLogging } from '@lib/renderer/withLogging.js';

// AppLayout 包括导航栏和客户区
function AppLayoutBase(): React.JSX.Element {
  const isNavBarVisible = useAppSelector(state => state.ui.layout.isNavBarVisible);

  return (
    // flex横向布局(flex flex-row)，宽度/高度 撑满父容器剩余空间(flex-1 min-h-0 min-w-0)
    <div id="AppLayout" className="flex flex-row flex-1 min-h-0 min-w-0">
      {isNavBarVisible && (<NavBar />)}
      <ClientContent />
    </div>
  );
}

export const AppLayout = withLogging(AppLayoutBase, { name: 'AppLayout' });
