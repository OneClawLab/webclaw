import type { Rectangle } from 'electron';

// 主窗口的 状态信息，由 main 进程维护，并通过 ipc 同步到 renderer 进程
export interface FrameState {
  bounds: Rectangle;
  maximized: boolean;
  fullscreen: boolean;
}

// 主窗口的 布局设置，由 renderer 进程自己维护
interface LayoutSettings {
  isNavBarVisible: boolean;
  isOutlineViewVisible: boolean;
  isTabAreaVisible: boolean;
  isSidePanelVisible: boolean;
  isStatusBarVisible: boolean;

  outlineWidth: number
  outlineCollapsed: boolean
  sidePanelWidth: number
  sidePanelCollapsed: boolean
}

// ui slice 的状态
export interface UIState {
  frame: FrameState;
  layout: LayoutSettings;
}

export const initialState: UIState = {
  frame: {
    bounds: { x: 0, y: 0, width: 600, height: 480 },
    maximized: false,
    fullscreen: false,
  },
  layout: {
    isNavBarVisible: true,
    isOutlineViewVisible: true,
    isTabAreaVisible: true,
    isSidePanelVisible: false,
    isStatusBarVisible: true,

    outlineWidth: 250,
    outlineCollapsed: false,
    sidePanelWidth: 300,
    sidePanelCollapsed: false,
  },
};
