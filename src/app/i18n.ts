import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import translationAR from '../locales/ar/translation.json';
import translationEN from '../locales/en/translation.json';

const resources = {
  ar: {
    translation: translationAR,
  },
  en: {
    translation: translationEN,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'ar',
    react: {
      useSuspense: false,
    },
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

/** The only genuinely client-side "setting" in the app — no backend concept of it exists. */
export const toggleLanguage = (): void => {
  const nextLang = i18n.language === 'ar' ? 'en' : 'ar';
  i18n.changeLanguage(nextLang);
  document.dir = nextLang === 'ar' ? 'rtl' : 'ltr';
};

export default i18n;
