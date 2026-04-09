import { useState, useEffect } from 'react';
import i18next from 'i18next';

/**
 * React hook that provides translation function and automatically re-renders
 * components when language changes
 */
export function useTranslation() {
  const [, forceUpdate] = useState({});

  useEffect(() => {
    const handleLanguageChanged = () => {
      forceUpdate({});
    };

    i18next.on('languageChanged', handleLanguageChanged);

    return () => {
      i18next.off('languageChanged', handleLanguageChanged);
    };
  }, []);

  return {
    t: i18next.t.bind(i18next),
    language: i18next.language,
  };
}