import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MediaLog",
  description: "动画 / 漫画 / 电影追踪表",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-Hans">
      <body>{children}</body>
    </html>
  );
}
