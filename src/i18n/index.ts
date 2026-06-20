import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import commonEn from './locales/en/common.json';
import settingsEn from './locales/en/settings.json';
import commonZh from './locales/zh/common.json';
import settingsZh from './locales/zh/settings.json';

export const defaultNS = 'common';
export const resources = {
  en: {
    common: commonEn,
    settings: settingsEn,
  },
  zh: {
    common: commonZh,
    settings: settingsZh,
  },
} as const;

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'zh',
    fallbackLng: 'en',
    defaultNS,
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
    // In development mode, warn about missing keys
    saveMissing: import.meta.env?.DEV,
    missingKeyHandler: (lngs, ns, key) => {
      console.warn(`[i18n] Missing key: ${ns}:${key} for ${lngs}`);
    },
  });

export default i18n;
