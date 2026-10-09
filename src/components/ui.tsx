import type { ButtonHTMLAttributes } from "react";
import type { Category, Status, Watch } from "@/lib/schema";

const BUTTON = {
  base:
    "cursor-pointer whitespace-nowrap rounded-lg border px-[13px] py-1.5 text-[13px] " +
    "transition-colors active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45",
  default:
    "border-line bg-raised text-ink enabled:hover:border-accent-dim enabled:hover:bg-accent/15",
  ghost:
    "border-line bg-transparent text-ink enabled:hover:border-accent-dim enabled:hover:bg-accent/15",
  primary:
    "border-accent bg-accent font-semibold text-[#0b1220] " +
    "enabled:hover:border-transparent enabled:hover:bg-[color-mix(in_srgb,var(--accent)_82%,#fff)]",
  danger:
    "border-transparent bg-transparent text-red enabled:hover:border-red enabled:hover:bg-red/15",
  sm: "!px-[9px] !py-1 !text-xs",
};

export function Button({
  variant = "default",
  small,
  className = "",
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "ghost" | "primary" | "danger";
  small?: boolean;
}) {
  return (
    <button
      type={type}
      className={`${BUTTON.base} ${BUTTON[variant]} ${small ? BUTTON.sm : ""} ${className}`}
      {...rest}
    />
  );
}

const TONE: Record<Watch | Status | Category, string> = {
  未看: "text-ink-faint border-line",
  看着: "text-amber bg-amber/15",
  看完了: "text-green bg-green/15",
  未完结: "text-accent bg-accent/15",
  完结: "text-ink-dim bg-raised",
  动画: "text-purple bg-purple/15",
  漫画: "text-green bg-green/15",
  电影: "text-red bg-red/15",
};

export function Pill({ value }: { value: Watch | Status | Category }) {
  return (
    <span
      className={`inline-block rounded-full border border-transparent px-2 py-px text-[11px] leading-[1.6] whitespace-nowrap ${TONE[value]}`}
    >
      {value}
    </span>
  );
}
