/* The UI language: Chinese by default, English on request. The choice is kept
 * in localStorage (medialog:lang), per browser, and other tabs follow it.
 *
 * Pages are prerendered in Chinese, so the server and the first (hydration)
 * render are always Chinese; components read the language through
 * useLocale() (components/locale.tsx), which switches right after. Code that
 * runs outside React (toasts from lib code, import errors) calls t(). */

import { LOCALES, MESSAGES, type Locale, type Messages } from "./messages";

export { LOCALES, MESSAGES, type Locale, type Messages };

const KEY = "medialog:lang";
let current: Locale | null = null;
const listeners = new Set<() => void>();

function read(): Locale {
  try {
    const v = localStorage.getItem(KEY);
    return LOCALES.includes(v as Locale) ? (v as Locale) : "zh";
  } catch {
    return "zh"; // storage blocked: the default
  }
}

/** The chosen language. Always "zh" on the server and in tests. */
export function getLocale(): Locale {
  if (typeof window === "undefined") return "zh";
  return (current ??= read());
}

export function setLocale(locale: Locale) {
  current = locale;
  try {
    localStorage.setItem(KEY, locale);
  } catch {
    /* not remembered, but still switched for this visit */
  }
  listeners.forEach((l) => l());
}

export function subscribeLocale(listener: () => void) {
  listeners.add(listener);
  // Another tab switched.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    current = read();
    listener();
  };
  addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    removeEventListener("storage", onStorage);
  };
}

/** The messages for the chosen language, for code outside React. */
export const t = (): Messages => MESSAGES[getLocale()];

/** `<html lang>` for a language. */
export const htmlLang = (locale: Locale) =>
  locale === "en" ? "en" : "zh-Hans";

/* Analytics names a click by its label (lib/analytics.ts clickName). So that
 * a button counts as one thing whichever language it was clicked in, an
 * English label is reported as its Chinese one: every English string in the
 * messages maps back to the Chinese string in the same place. */
let toZh: Map<string, string> | null = null;

function pair(en: unknown, zh: unknown, out: Map<string, string>) {
  if (typeof en === "string" && typeof zh === "string") {
    if (en !== zh && !out.has(en)) out.set(en, zh);
  } else if (en && zh && typeof en === "object" && typeof zh === "object") {
    for (const k of Object.keys(en))
      pair(
        (en as Record<string, unknown>)[k],
        (zh as Record<string, unknown>)[k],
        out,
      );
  }
}

/** A click name in Chinese: an English UI string becomes the Chinese one it
 *  translates; anything else is returned as is. */
export function zhName(name: string): string {
  if (!toZh) {
    toZh = new Map();
    pair(MESSAGES.en, MESSAGES.zh, toZh);
  }
  return toZh.get(name) ?? name;
}
