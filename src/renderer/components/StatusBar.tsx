import React, { useEffect, useRef, useState } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { LucideIcon, LucideIconProps } from '@lib/renderer/LucideIcon.js';
import { useAppDispatch, useAppSelector } from '@state/storeHolder.js';
import { DocUtils } from '@state/slices/doc/utils.js';
import { settingsActions } from '@state/slices/settings/slice.js';
import { connectionActions } from '@state/slices/connection/slice.js';
import { agentActions } from '@state/slices/agent/slice.js';
import { useTranslation } from '@lib/renderer/useTranslation.js';
import { toast } from '@lib/renderer/dialog.js';
import { dialog } from '@lib/renderer/dialog.js';
import { useAppEventBus } from '@event/app.js';

interface StatusBarElementProps {
  dynamic?: boolean;        // 表示此元素是动态元素，可点击鼠标有动作，因此要加亮显示
  className?: string;       // 额外的 CSS 类名
  label: string;            // 左侧标签
  value: string;            // 右侧值
  tooltip?: string;         // 鼠标悬停时显示的提示文本
  iconName?: LucideIconProps['name']; // 使用你的 icon 名称
  iconSize?: number;
  iconColor?: string;
  onClick?: () => void;     // 点击时的回调函数
}

export const StatusBarElement: React.FC<StatusBarElementProps> = ({
  dynamic = false,
  className = '',
  label = '',
  value = '',
  tooltip,
  iconName,
  iconSize = 16,
  iconColor = 'currentColor',
  onClick,
}) => {
  const DYNAMIC = dynamic ? 'Dynamic' : '';
  return (
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <div className={`StatusBarElement ${className} ${DYNAMIC}`} onClick={onClick}>
            {iconName && <LucideIcon name={iconName} size={iconSize} color={iconColor} />}
            {label && (<span className={`StatusBarLabel ${className}`}>{label}</span>)}
            {value && (<span className={`StatusBarValue ${className}`}>{value}</span>)}
          </div>
        </Tooltip.Trigger>
        {tooltip && (
          <Tooltip.Content className="StatusBarTooltip" side="top" align="center" sideOffset={4}>
            {tooltip}
            <Tooltip.Arrow className="StatusBarTooltipArrow" />
          </Tooltip.Content>
        )}
      </Tooltip.Root>
    </Tooltip.Provider>
  );
};

interface StatusBarProps {
  elements: StatusBarElementProps[];
}

export const StatusBar: React.FC<StatusBarProps> = ({ elements }) => {
  return (
    <div id='StatusBar'>
      {elements.map((el, idx) => (
        <StatusBarElement key={idx} {...el} />
      ))}
    </div>
  );
};

export const StatusBarEx = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const libs = useAppSelector((state) => state.lib.libs);
  const tabs = useAppSelector((state) => state.tab.tabs);
  const progressMode = useAppSelector((state) => state.settings.progressMode);
  const activeTabId = useAppSelector((state) => state.tab.activeTabId);
  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const runtime = useAppSelector((state) => state.runtime);

  const docId = activeTab ? activeTab.docId : null;
  const activeDoc = docId ? DocUtils.getDocById(docId) : null;
  const docPath = activeDoc ? DocUtils.docPath(activeDoc) : '';
  const docIdTooltip = activeDoc ? `Document ID: ${docId!}\n File Path: ${docPath}` : `Document ID: ${docId!}`;

  // xgw connection status
  const connectionStatus = useAppSelector((state) => state.connection.status);
  const prevConnectionStatus = useRef(connectionStatus);

  // ctx_usage from active doc (per-conversation, updated by ai.ts)
  const activeDocCtxUsage = useAppSelector((state) => {
    const tab = state.tab.tabs.find(t => t.id === state.tab.activeTabId);
    if (!tab) return undefined;
    return state.doc.docs[tab.docId]?.ctxUsage;
  });

  // compact state (global, not per-doc) — driven by FrameRouter via AppEventBus
  const [compactMessage, setCompactMessage] = useState('');
  useAppEventBus('xgw:compact_start', ({ reason }) => {
    setCompactMessage(reason ? `压缩中 (${reason})…` : '压缩中…');
  });
  useAppEventBus('xgw:compact_end', ({ before_tokens, after_tokens }) => {
    const toK = (n: number) => `${Math.round(n / 1000)}K`;
    setCompactMessage(`压缩完成 ${toK(before_tokens)}→${toK(after_tokens)}`);
    setTimeout(() => setCompactMessage(''), 5000);
  });

  // Track if onFrame listener is already registered
  const frameListenerRegistered = useRef(false);

  // Connection status icon/color
  const connIconName: LucideIconProps['name'] =
    connectionStatus === 'authenticated' ? 'Wifi' :
    connectionStatus === 'reconnecting' ? 'WifiOff' :
    'WifiOff';
  const connIconColor =
    connectionStatus === 'authenticated' ? 'white' :
    connectionStatus === 'reconnecting' ? '#FFD700' :
    '#FF6B6B';
  const connTooltip = `TheClaw Gateway Status: ${connectionStatus}`;

  // Listen to xgw status changes and agent updates
  useEffect(() => {
    const xgw = (window as any).xgw;
    if (!xgw) return;

    xgw.onStatusChange((status: string) => {
      dispatch(connectionActions.setStatus(status as any));
    });

    xgw.onAgentsUpdate?.((agents: string[]) => {
      dispatch(agentActions.setAvailableAgents(agents));
    });
  }, [dispatch]);

  // Listen to xgw frames for progress events — now handled by FrameRouter
  // StatusBar only needs compact events, which come via AppEventBus above

  // Show toast when connection drops to disconnected
  useEffect(() => {
    if (prevConnectionStatus.current !== 'disconnected' && connectionStatus === 'disconnected') {
      toast.show('xgw 连接已断开', 'warn', '连接断开');
    }
    prevConnectionStatus.current = connectionStatus;
  }, [connectionStatus]);

  const onClickConnection = () => {
    dialog.showModal({ id: 'connection-settings', type: 'connection-settings', props: {
      onClose: () => dialog.hideModal('connection-settings')
    }});
  };

  return (
    <StatusBar
      elements={[
        { label: 'Libs:',
          dynamic: true,
          value: `${Object.keys(libs).length}`,
          iconName: 'Library',
          tooltip: `Total libraries: ${Object.keys(libs).length}`
        },          
        { label: 'Tabs:',
          dynamic: true, 
          value: `${tabs.length}`,
          iconName: 'Columns2',
          tooltip: `Total open tabs: ${tabs.length}`
        },
        { label: '', // xgw 连接状态
          dynamic: true, 
          value: connectionStatus,
          iconName: connIconName,
          iconColor: connIconColor,
          tooltip: connTooltip,
          className: 'Strong',
          onClick: onClickConnection
        },
        { label: '',
          dynamic: true, 
          value: `${progressMode}`,
          iconName: 'Activity',
          tooltip: `${progressMode === 'verbose' ? 'progress will be appended and never cleared' : 'always show latest line of progress'}`,
          className: progressMode === 'verbose' ? 'Strong' : '', 
          onClick: () => {
            const nextMode = progressMode === 'simple' ? 'verbose' : 'simple';
            dispatch(settingsActions.setProgressMode(nextMode));
          }
        },
        ...(compactMessage ? [{ label: '', value: compactMessage, iconName: 'Loader' as LucideIconProps['name'], className: 'Grayed text-xs' }] : []),
        ...(activeDocCtxUsage ? (() => {
          const toK = (n: number) => `${Math.round(n / 1000)}K`;
          const pct = Math.round(activeDocCtxUsage.pct);
          const ctxColor = pct >= 90 ? '#FF6B6B' : pct >= 70 ? '#FFD700' : 'white';
          return [{ 
            label: '', 
            value: `${pct}%`, 
            iconName: 'BrainCircuit' as LucideIconProps['name'],
            iconColor: ctxColor,
            tooltip: `ctx: ${toK(activeDocCtxUsage.total_tokens)} / ${toK(activeDocCtxUsage.budget_tokens)}`,
            className: 'Grayed text-xs',
          }];
        })() : []),
        { label: '', value: '', className: 'flex-1' },
        { label: 'ActiveTab= {', value: '', className: 'Grayed' },
        ...(activeTab
          ? [
              { label: `TabId:`,
                dynamic: true,
                value: `${activeTab.id}` 
              },
              { label: `DocId:`,
                dynamic: true,
                value: `${activeTab.docId}`, 
                tooltip: docIdTooltip
              },
              { label: `Dirty:`,
                dynamic: true, 
                value: `${activeTab._dirty ? 'Y' : 'N'}`, 
                iconName: activeTab._dirty ? 'CircleAlert' : 'CircleCheck' as LucideIconProps['name'], 
                className: activeTab._dirty ? 'Highlight' : '' , 
                tooltip: activeTab._dirty ? 'This tab has unsaved changes' : 'This tab is clean'
              },
              { label: `AutoScroll:`,
                dynamic: true,
                value: `${activeTab._autoScroll ? 'Y' : 'N'}`, 
                className: activeTab._autoScroll ? 'Highlight' : '', 
                tooltip: activeTab._autoScroll ? 'AutoScroll is ON' : 'AutoScroll is OFF'
              },
              { label: '',
                dynamic: true,
                value: `Ln ${runtime.cursor.line}, Col ${runtime.cursor.col}`, 
                tooltip: `Line ${runtime.cursor.line}, Column ${runtime.cursor.col}`
              },
              { label: `Sel:`,
                dynamic: true, 
                value: `${runtime.selection.from}-${runtime.selection.to}/${runtime.selection.total}`, 
                tooltip: `Selection from ${runtime.selection.from} to ${runtime.selection.to} of total ${runtime.selection.total}`
              },
            ]
          : [{ label: '-', value: '' }]),
        { label: '}', value: '', className: 'Grayed' },

        { label: ' ', value: '', className: 'min-w-4' },
        { label: '',
          dynamic: true,
          value: '',
          iconName: 'Bell',
          tooltip: 'No Notifications' 
        },
      ]}
    />
  );
};
