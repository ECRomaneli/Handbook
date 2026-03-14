/**
 * Internationalization (i18n) manager
 */
import { de } from './de';
import { en } from './en';
import { es } from './es';
import { fr } from './fr';
import { it } from './it';
import { ptBR } from './pt-BR';
import { ptPT } from './pt-PT';
import { ru } from './ru';

export type Strings = typeof en & Record<string, unknown>;

const locales = {
  en,
  de,
  es,
  fr,
  it,
  'pt-BR': ptBR,
  'pt-PT': ptPT,
  ru,
};

export type Language = keyof typeof locales;

export const availableLanguages = Object.keys(locales) as Language[];

/**
 * Get translations for a specific language
 * @param lang Language code
 * @returns Translation strings
 */
export const getStrings = (lang: Language): Strings => {
  return locales[lang] || locales.en;
};

/**
 * Resolve a locale string to a supported Language key.
 * Tries exact match first, then base language fallback.
 */
export const resolveLanguage = (lang: string): Language => {
  if (lang in locales) { return lang as Language; }
  const baseLang = lang.split('-')[0];
  if (baseLang in locales) { return baseLang as Language; }
  return 'en';
};

export const getLanguageStrings = (lang: string): Strings => getStrings(resolveLanguage(lang));
