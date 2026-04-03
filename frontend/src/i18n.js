import { createI18n } from 'vue-i18n';
import ru from './locales/ru.json';
import en from './locales/en.json';
import by from './locales/by.json';
import sk from './locales/sk.json';

const LOCALE_STORAGE_KEY = 'moodscape_locale';
const LOCALE_SOURCE_STORAGE_KEY = 'moodscape_locale_source';

const normalizeLocale = (value) => {
  const prefix = String(value || '')
    .split('-')[0]
    .toLowerCase();

  if (prefix === 'ru') return 'ru';
  if (prefix === 'be' || prefix === 'by') return 'by';
  if (prefix === 'sk') return 'sk';
  return 'en';
};

const getDocumentLanguage = (locale) => (locale === 'by' ? 'be' : locale);

export const applyDocumentLanguage = (locale) => {
  document.documentElement.lang = getDocumentLanguage(locale);
};

const getSystemLanguage = () => {
  const preferredLanguages = Array.isArray(navigator.languages) && navigator.languages.length
    ? navigator.languages
    : [navigator.language || navigator.userLanguage || ''];

  return normalizeLocale(preferredLanguages.find(Boolean));
};

const getInitialLocale = () => {
  const savedLocale = normalizeLocale(localStorage.getItem(LOCALE_STORAGE_KEY));
  const localeSource = localStorage.getItem(LOCALE_SOURCE_STORAGE_KEY);

  if (localeSource === 'user' && savedLocale) {
    return savedLocale;
  }

  return getSystemLanguage();
};

export const setPreferredLocale = (locale, { source = 'user' } = {}) => {
  const normalizedLocale = normalizeLocale(locale);
  localStorage.setItem(LOCALE_STORAGE_KEY, normalizedLocale);
  localStorage.setItem(LOCALE_SOURCE_STORAGE_KEY, source);
  applyDocumentLanguage(normalizedLocale);
  i18n.global.locale.value = normalizedLocale;
  return normalizedLocale;
};

const initialLocale = getInitialLocale();

applyDocumentLanguage(initialLocale);

export const i18n = createI18n({
  locale: initialLocale,
  fallbackLocale: 'en',
  messages: {
    ru,
    en,
    by,
    sk,
  },
  legacy: false,
  globalInjection: true,
});
