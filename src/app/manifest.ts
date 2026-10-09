import type { MetadataRoute } from "next";

/* The web app manifest (served at /manifest.webmanifest). Makes MediaLog
 * installable: on Android/desktop Chrome via the install prompt, on iOS via
 * Share → 添加到主屏幕. Icons come from scripts/generate-icons.mjs. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "MediaLog · 追番追漫记录",
    short_name: "MediaLog",
    description: "动画 / 漫画 / 电影追踪表",
    lang: "zh-Hans",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // Dark is the app's default theme; the splash screen matches it.
    background_color: "#0b0c10",
    theme_color: "#0b0c10",
    categories: ["entertainment", "books", "lifestyle"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    // Long-press the app icon → 新增作品.
    shortcuts: [
      {
        name: "新增作品",
        short_name: "新增",
        url: "/?new=1",
        icons: [
          {
            src: "/icons/shortcut-add-96.png",
            sizes: "96x96",
            type: "image/png",
          },
        ],
      },
    ],
    // Android: share a page from the browser to MediaLog to add it, with the
    // page title and link filled in.
    share_target: {
      action: "/",
      method: "GET",
      // The default, but Chromium warns when it is left out.
      enctype: "application/x-www-form-urlencoded",
      params: { title: "title", text: "text", url: "url" },
    },
  };
}
