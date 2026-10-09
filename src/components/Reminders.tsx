"use client";

/* The 更新提醒 dialog: what gets followed, turning it on and off, a test
 * notification, and whether the server's checks are actually running. Opened
 * from the sidebar and the phone's ⋯ menu (Chrome.tsx). */

import { Bell, BellOff, BookOpen, Send, Tv } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { relTime } from "@/lib/format";
import type { Install } from "./Pwa";
import type { Reminders } from "./useReminders";

/** Why reminders can't be turned on here, if they can't. */
function Blocker({
  reminders,
  install,
}: {
  reminders: Reminders;
  install: Install;
}): ReactNode {
  switch (reminders.state) {
    case "unconfigured":
      return (
        <Note>
          服务器还没有配置更新提醒：需要推送密钥（VAPID）、存储和定时任务，步骤见
          README「更新提醒」。
        </Note>
      );
    case "unsupported":
      return (
        <Note>
          {process.env.NODE_ENV === "production"
            ? "这个浏览器不支持推送通知。可以换成 Chrome、Edge、Firefox，或者 iPhone 上从主屏幕打开的 MediaLog。"
            : "开发模式（npm run dev）没有 service worker，收不到推送。用 npm run build && npm start 试。"}
        </Note>
      );
    case "install":
      return (
        <Note>
          iPhone / iPad 上要先把 MediaLog 添加到主屏幕（iOS 16.4
          以上），再从主屏幕打开，才能开启提醒。
          {install.mode === "ios" && (
            <Button
              variant="link"
              className="h-auto p-0 align-baseline"
              onClick={() => {
                reminders.setOpen(false);
                install.install();
              }}
            >
              怎么添加
            </Button>
          )}
        </Note>
      );
    case "blocked":
      return (
        <Note>
          这个网站的通知权限被拒绝了。在浏览器的网站设置里允许 MediaLog
          发送通知，再回来开启。
        </Note>
      );
    default:
      return null;
  }
}

function Note({ children }: { children: ReactNode }) {
  return (
    <p className="bg-muted text-muted-foreground rounded-lg px-3 py-2.5 text-[13px] leading-relaxed">
      {children}
    </p>
  );
}

export function RemindersDialog({
  reminders: r,
  install,
}: {
  reminders: Reminders;
  install: Install;
}) {
  const { all, anime, manga } = r.follows;
  const blocker = <Blocker reminders={r} install={install} />;
  const on = r.state === "on";
  return (
    <Dialog open={r.open} onOpenChange={r.setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>更新提醒</DialogTitle>
          <DialogDescription>
            「看着」的作品出了新一集、新一话，就推送通知到这台设备。
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 text-sm">
          <ul className="flex flex-col gap-2.5">
            <li className="flex gap-3">
              <Tv aria-hidden className="text-purple mt-0.5 size-4 shrink-0" />
              <span>
                <b className="font-medium">动画 {anime} 部</b>
                <span className="text-muted-foreground">
                  ：链接是 AniList 的（从「发现」加入的都是），新一集播出后提醒
                </span>
              </span>
            </li>
            <li className="flex gap-3">
              <BookOpen
                aria-hidden
                className="text-sky mt-0.5 size-4 shrink-0"
              />
              <span>
                <b className="font-medium">漫画 {manga} 部</b>
                <span className="text-muted-foreground">
                  ：链接是漫画柜（manhuagui.com）的，出新章节后提醒（每部每{" "}
                  {r.status?.mangaHours ?? 6} 小时查一次）
                </span>
              </span>
            </li>
          </ul>
          {all.length === 0 && r.state !== "loading" && (
            <Note>
              现在没有符合条件的作品：把观看状态设为「看着」，并填上 AniList
              或漫画柜的链接。
            </Note>
          )}
          {blocker}
          {on && r.status && (
            <p className="text-muted-foreground text-[13px]">
              {r.status.lastRun
                ? `服务器上次检查：${relTime(r.status.lastRun)}`
                : "服务器还没有检查过：需要设置定时任务，见 README「更新提醒」"}
              {r.status.failing.length > 0 && (
                <span className="text-destructive block">
                  {r.status.failing.length} 部读取失败：
                  {r.status.failing
                    .slice(0, 3)
                    .map((f) => `${f.name}（${f.error}）`)
                    .join("、")}
                  {r.status.failing.length > 3 && " 等"}
                </span>
              )}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          {on ? (
            <>
              <Button
                variant="outline"
                onClick={r.test}
                disabled={r.busy}
                className="max-md:h-11"
              >
                <Send aria-hidden />
                发送测试通知
              </Button>
              <Button
                variant="outline"
                onClick={r.disable}
                disabled={r.busy}
                className="max-md:h-11"
              >
                <BellOff aria-hidden />
                关闭提醒
              </Button>
            </>
          ) : (
            <Button
              onClick={r.enable}
              disabled={r.busy || r.state !== "off"}
              className="max-md:h-11"
            >
              <Bell aria-hidden />
              开启提醒
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
