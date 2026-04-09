import { Logger } from '@lib/logast.js';
import { useEffect, useState } from 'react';
import { useAppSelector, useAppDispatch } from '@state/storeHolder.js';
import { changeLanguage, resolveLanguage } from '@lib/i18n.js';
import { settingsActions } from '@state/slices/settings/slice.js';
import i18next from 'i18next';

/**
 * Hook to synchronize language settings with i18n
 * This hook should be used once in the main App component
 */
export function useLanguageSync() {
  const dispatch = useAppDispatch();
  const languageSetting = useAppSelector(state => state.settings.language);
  const [, forceUpdate] = useState({});

  useEffect(() => {
    // 当语言设置改变时，更新i18n
    const actualLanguage = resolveLanguage(languageSetting);
    Logger.info('[i18n] change language to: ', actualLanguage);
    changeLanguage(languageSetting).catch(error => {
      Logger.error('[i18n] Failed to change language:', error);
    });
  }, [languageSetting]);

  useEffect(() => {
    // 监听i18next的语言变化事件，强制重新渲染所有组件
    const handleLanguageChanged = () => {
      Logger.info('[i18n] Language changed, forcing re-render');
      forceUpdate({});
    };

    i18next.on('languageChanged', handleLanguageChanged);

    return () => {
      i18next.off('languageChanged', handleLanguageChanged);
    };
  }, []);

  // 返回一个函数来更改语言设置
  const setLanguage = (language: string) => {
    dispatch(settingsActions.setLanguage(language));
  };

  return { setLanguage };
}