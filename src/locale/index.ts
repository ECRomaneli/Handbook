/**
 * Internationalization (i18n) manager
 */
import { en, type Strings } from './en';

export type Language = 'en';

const locales: Record<Language, Strings> = {
  en,
};

/**
 * Get translations for a specific language
 * @param lang Language code
 * @returns Translation strings
 */
export const getStrings = (lang: Language): Strings => {
  return locales[lang] || locales.en;
};

/**
 * Get current system language or default to English
 */
export const getSystemLanguage = (): Language => {
  // const lang = navigator.language || 'en';
  return 'en';
};

export { en };
