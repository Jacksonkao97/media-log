import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MediaLog",
  description: "动画 / 漫画 / 电影追踪表",
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
  return (
    <html lang="zh-Hans">
      <body>{children}</body>
    </html>
  );
}
