import { ru } from './ru'

export type Lang = 'en' | 'ru'
export type Translate = (text: string) => string

export const LANGS: { id: Lang; label: string }[] = [
  { id: 'en', label: 'EN' },
  { id: 'ru', label: 'RU' },
]

/** Each language maps the English text to its own; English needs no map. */
const WORDS: Record<Lang, Record<string, string>> = { en: {}, ru }
const KEY = 'lang'
const known = (id: string | null | undefined): id is Lang => LANGS.some((l) => l.id === id)

export const translator =
  (lang: Lang): Translate =>
  (text) =>
    WORDS[lang][text] ?? text

/** `?lang=` in the address, then the remembered choice, then the browser's language. */
export function initialLang(): Lang {
  const asked = new URLSearchParams(location.search).get('lang')
  if (known(asked)) return asked
  try {
    const stored = localStorage.getItem(KEY)
    if (known(stored)) return stored
  } catch {
    // No stored choice can be read.
  }
  const browser = navigator.language.slice(0, 2)
  return known(browser) ? browser : 'en'
}

export function remember(lang: Lang) {
  try {
    localStorage.setItem(KEY, lang)
  } catch {
    // The choice then lasts for this visit only.
  }
}
