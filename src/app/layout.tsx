import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Analytics } from "@/components/Analytics";
import { PwaProvider } from "@/components/Pwa";
import { gaId, gaSnippet } from "@/lib/analytics";
import "./globals.css";

export const metadata: Metadata = {
  title: "MediaLog",
  description: "动画 / 漫画 / 电影追踪表",
  applicationName: "MediaLog",
  // iOS home-screen app: full screen, content under a translucent status bar
  // (bars already pad for env(safe-area-inset-top)).
  appleWebApp: {
    capable: true,
    title: "MediaLog",
    statusBarStyle: "black-translucent",
  },
  // Don't turn episode numbers into phone links on iOS.
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  // Lets content reach the screen edges on notched phones; padding uses safe-area insets.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0c10" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const ga = gaId();
  return (
    <html lang="zh-Hans">
      {/* Google's tag, as plain tags in the prerendered HTML (lib/analytics.ts).
          The snippet is a fixed template around the validated ID. */}
      {ga && (
        <head>
          <script
            id="ga-snippet"
            dangerouslySetInnerHTML={{ __html: gaSnippet(ga) }}
          />
          <script
            async
            src={`https://www.googletagmanager.com/gtag/js?id=${ga}`}
          />
        </head>
      )}
      <body>
        <PwaProvider>{children}</PwaProvider>
        {/* useSearchParams needs a Suspense boundary on prerendered pages. */}
        {ga && (
          <Suspense>
            <Analytics id={ga} />
          </Suspense>
        )}
      </body>
    </html>
  );
}
