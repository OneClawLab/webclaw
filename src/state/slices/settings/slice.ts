import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { initialState, setFeatureEnabled, VERSION_AUTO_INSTALL_UPDATES, VERSION_CHECK_FOR_UPDATES, VERSION_SHOW_WELCOME_ON_STARTUP } from './types.js';

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setShowWelcomeOnStartup(state, action: PayloadAction<boolean>) {
      state.showWelcomeOnStartup = setFeatureEnabled(action.payload, VERSION_SHOW_WELCOME_ON_STARTUP);
    },
    setCheckForUpdates(state, action: PayloadAction<boolean>) {
      state.checkForUpdates = setFeatureEnabled(action.payload, VERSION_CHECK_FOR_UPDATES);
    },
    setAutoInstallUpdates(state, action: PayloadAction<boolean>) {
      state.autoInstallUpdates = setFeatureEnabled(action.payload, VERSION_AUTO_INSTALL_UPDATES);
    },
    updateAiStatus(state, action: PayloadAction<AiStatus>) {
      state.aiStatus = action.payload;
    },
    setFrontAgentName(state, action: PayloadAction<string>) {
      state.frontAgentName = action.payload;
    },
    setProgressMode(state, action: PayloadAction<'simple' | 'verbose'>) {
      state.progressMode = action.payload;
    },
    setLanguage(state, action: PayloadAction<string>) {
      state.language = action.payload;
    },
  },
});

export const settingsActions = settingsSlice.actions
export default settingsSlice.reducer
