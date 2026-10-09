/* The privacy policy and terms (/privacy, /terms): plain prerendered pages,
 * Chinese first with an English version below. Google's consent screen links
 * to both, so keep them public and keep them true: when what the app stores
 * or sends changes (e.g. 更新提醒 is switched back on), update them and
 * LEGAL_UPDATED. */

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

/** The public contact address; the consent screen's support email too. */
export const CONTACT_EMAIL = "jacksonkao97@gmail.com";
/** When the pages last changed; shown as the effective date. */
export const LEGAL_UPDATED = {
  zh: "2026 年 10 月 10 日",
  en: "October 10, 2026",
};

const LINK = "text-primary underline underline-offset-2 hover:no-underline";

export function Mail() {
  return (
    <a href={`mailto:${CONTACT_EMAIL}`} className={LINK}>
      {CONTACT_EMAIL}
    </a>
  );
}

export function Ext({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer noopener" className={LINK}>
      {children}
    </a>
  );
}

export function LegalPage({
  title,
  enTitle,
  zh,
  en,
}: {
  title: string;
  enTitle: string;
  zh: ReactNode;
  en: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 pt-10 pb-20 text-[15px] leading-relaxed max-md:px-4 max-md:pt-6">
      <Link
        href="/"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft aria-hidden className="size-4" />
        返回 MediaLog
      </Link>

      <article lang="zh-Hans" className="mt-6">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          生效日期：{LEGAL_UPDATED.zh} ·{" "}
          <a href="#en" className={LINK}>
            English
          </a>
        </p>
        {zh}
      </article>

      <article id="en" lang="en" className="mt-14 border-t pt-10">
        <h1 className="text-2xl font-semibold tracking-tight">{enTitle}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Effective {LEGAL_UPDATED.en}
        </p>
        {en}
      </article>

      <footer className="text-faint mt-14 flex gap-4 border-t pt-6 text-xs">
        <Link href="/privacy" className="hover:text-foreground">
          隐私政策 Privacy
        </Link>
        <Link href="/terms" className="hover:text-foreground">
          服务条款 Terms
        </Link>
      </footer>
    </main>
  );
}

export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="text-muted-foreground mt-2 flex flex-col gap-2">
        {children}
      </div>
    </section>
  );
}

export function List({ children }: { children: ReactNode }) {
  return (
    <ul className="marker:text-faint flex list-disc flex-col gap-1.5 pl-5">
      {children}
    </ul>
  );
}
