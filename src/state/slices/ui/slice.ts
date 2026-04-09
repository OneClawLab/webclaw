import { Logger, Assert } from '@lib/logast.js'
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { initialState, FrameState } from './types.js';

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    updateFrameState(state, action: PayloadAction<{ state: FrameState }>) {
      state.frame = action.payload.state;
      //Logger.debug('UI Slice: Updated window frame state: ' + JSON.stringify(state.frame));
    },
    toggleNavBarVisible(state) {
      //Logger.debug('UI Slice: Toggling nav bar visibility: to ' + !state.layout.isNavBarVisible);
      state.layout.isNavBarVisible = !state.layout.isNavBarVisible;
    },
    toggleOutlineViewVisible(state) {
      //Logger.debug('UI Slice: Toggling outline view visibility: to ' + !state.layout.isOutlineViewVisible);
      state.layout.isOutlineViewVisible = !state.layout.isOutlineViewVisible;
    },
    toggleStatusBarVisible(state) {
      //Logger.debug('UI Slice: Toggling status bar visibility: to ' + !state.layout.isStatusBarVisible);
      state.layout.isStatusBarVisible = !state.layout.isStatusBarVisible;
    },
    toggleTabAreaVisible(state) {
      //Logger.debug('UI Slice: Toggling tab area visibility: to ' + !state.layout.isTabAreaVisible);
      state.layout.isTabAreaVisible = !state.layout.isTabAreaVisible;
    },
    toggleSidePanelVisible(state) {
      //Logger.debug('UI Slice: Toggling side panel visibility: to ' + !state.layout.isSidePanelVisible);
      state.layout.isSidePanelVisible = !state.layout.isSidePanelVisible;
    },

    setOutlineWidth(state, action: PayloadAction<number>) {
      state.layout.outlineWidth = action.payload
    },
    setOutlineCollapsed(state, action: PayloadAction<boolean>) {
      state.layout.outlineCollapsed = action.payload
    },
    setSidePanelWidth(state, action: PayloadAction<number>) {
      state.layout.sidePanelWidth = action.payload
    },
    setSidePanelCollapsed(state, action: PayloadAction<boolean>) {
      state.layout.sidePanelCollapsed = action.payload
    },

  },
});

export const uiActions = uiSlice.actions
export default uiSlice.reducer
