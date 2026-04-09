import React from 'react';
import { WelcomeView } from '../views/WelcomeView.js';
import { WorkspaceView } from './WorkspaceView.js';
import { useAppSelector } from '@state/storeHolder.js';
import { withLogging } from '@lib/renderer/withLogging.js';

// 客户区 根据状态分为 WelcomeView 和 WorkspaceView
// 没打开 任何 Library时 显示 WelcomeView，否则显示 WorkspaceView
function ClientContentBase(): React.JSX.Element {
  const libs = useAppSelector(state => state.lib.libs);

  if (Object.keys(libs).length > 0)
    return <WorkspaceView />
  else
    return <WelcomeView />
}

export const ClientContent = withLogging(ClientContentBase, { name: 'ClientContent' });
