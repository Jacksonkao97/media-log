"use client";

/* The UI language for React (lib/i18n.ts). One store subscription at the top
 * of the app, passed down by context, so the 700 list rows don't each
 * subscribe. Hydration renders Chinese, as the prerendered HTML is. */

import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  MESSAGES,
  getLocale,
  htmlLang,
  subscribeLocale,
  type Locale,
  type Messages,
} from "@/lib/i18n";

const LocaleContext = createContext<Locale>("zh");

export function LocaleProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(
    subscribeLocale,
    getLocale,
    () => "zh" as const,
  );
  useEffect(() => {
    document.documentElement.lang = htmlLang(locale);
  }, [locale]);
  return <LocaleContext value={locale}>{children}</LocaleContext>;
}

export const useLocale = () => useContext(LocaleContext);
export const useT = (): Messages => MESSAGES[useLocale()];
