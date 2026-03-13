/**
 * Internationalization (i18n) manager
 */
import { en, type Strings } from './en';
import { ptBR } from './pt-BR';

const locales = {
  en,
  'pt-BR': ptBR,
};

export type Language = keyof typeof locales;

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
  const lang = navigator.language || 'en';
  return lang === 'pt-BR' ? 'pt-BR' : 'en';
};

/**
 * Get translation strings for the current system language
 * @returns Translation strings
 */
export const getSystemStrings = (): Strings => {
  return getStrings(getSystemLanguage());
};
