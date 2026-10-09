import type { ButtonHTMLAttributes, ReactNode } from "react";
import { BookOpen, Film, Tv, type LucideIcon } from "lucide-react";
import type { Category, Status, Watch } from "@/lib/schema";

/* ---------------------------------------------------------------- buttons */

const VARIANT = {
  primary:
    "bg-accent text-accent-ink font-semibold enabled:hover:brightness-110",
  secondary: "border border-line bg-panel text-ink enabled:hover:bg-raised",
  ghost: "text-ink-dim enabled:hover:bg-raised enabled:hover:text-ink",
  danger: "text-red enabled:hover:bg-red/10",
};

export function Button({
  variant = "secondary",
  icon: Icon,
  className = "",
  type = "button",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof VARIANT;
  icon?: LucideIcon;
}) {
  return (
    <button
      type={type}
      className={`inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3.5 text-sm whitespace-nowrap transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40 max-md:h-11 ${VARIANT[variant]} ${className}`}
      {...rest}
    >
      {Icon && <Icon aria-hidden className="size-4 shrink-0" />}
      {children}
    </button>
  );
}

/** Square icon-only button. `label` is required: it is the accessible name. */
export function IconButton({
  icon: Icon,
  label,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`text-ink-dim enabled:hover:bg-raised enabled:hover:text-ink inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 max-md:size-11 ${className}`}
      {...rest}
    >
      <Icon aria-hidden className="size-[18px]" />
    </button>
  );
}

/* ----------------------------------------------------- toggles and choices */

export function Chip({
  pressed,
  icon: Icon,
  children,
  onClick,
}: {
  pressed: boolean;
  icon?: LucideIcon;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[13px] transition max-md:h-10 max-md:px-3.5 ${
        pressed
          ? "border-accent/50 bg-accent-dim text-ink"
          : "border-line text-ink-dim hover:border-ink-faint/60 hover:text-ink"
      }`}
    >
      {Icon && <Icon aria-hidden className="size-3.5" />}
      {children}
    </button>
  );
}

/** A row of mutually exclusive options. Uses real radio inputs inside a form
 *  (`name` set) so keyboard arrows and form semantics work; plain buttons with
 *  aria-pressed otherwise. */
export function Segmented<T extends string>({
  label,
  name,
  value,
  options,
  onChange,
  render = (o) => o,
  className = "",
}: {
  label: string;
  name?: string;
  value: T | null;
  options: readonly T[];
  onChange: (v: T) => void;
  render?: (o: T) => ReactNode;
  className?: string;
}) {
  const item = (on: boolean) =>
    `flex h-8 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md px-3 text-[13px] whitespace-nowrap transition max-md:h-10 ${
      on
        ? "bg-knob text-ink font-medium shadow-sm"
        : "text-ink-dim hover:text-ink"
    }`;
  const shell = `flex gap-1 rounded-lg bg-raised p-1 ${className}`;

  if (name) {
    return (
      <div role="radiogroup" aria-label={label} className={shell}>
        {options.map((o) => (
          <label
            key={o}
            className={`${item(o === value)} has-focus-visible:outline-accent has-focus-visible:outline-2`}
          >
            <input
              type="radio"
              name={name}
              value={o}
              checked={o === value}
              onChange={() => onChange(o)}
              className="sr-only"
            />
            {render(o)}
          </label>
        ))}
      </div>
    );
  }
  return (
    <div role="group" aria-label={label} className={shell}>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={o === value}
          onClick={() => onChange(o)}
          className={item(o === value)}
        >
          {render(o)}
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------- data display */

export const CATEGORY: Record<Category, { icon: LucideIcon; tone: string }> = {
  动画: { icon: Tv, tone: "bg-purple/12 text-purple" },
  漫画: { icon: BookOpen, tone: "bg-sky/12 text-sky" },
  电影: { icon: Film, tone: "bg-red/12 text-red" },
};

/** Category as a tinted icon tile. Shape, not just colour, tells them apart. */
export function CategoryTile({
  category,
  className = "",
}: {
  category: Category;
  className?: string;
}) {
  const { icon: Icon, tone } = CATEGORY[category];
  return (
    <span
      role="img"
      aria-label={category}
      title={category}
      className={`inline-flex size-9 shrink-0 items-center justify-center rounded-lg ${tone} ${className}`}
    >
      <Icon aria-hidden className="size-[18px]" />
    </span>
  );
}

const TAG_TONE: Record<Watch | Status, string> = {
  未看: "text-ink-faint",
  看着: "text-amber",
  看完了: "text-green",
  未完结: "text-sky",
  完结: "text-ink-faint",
};

/** Watch or series state: a coloured dot plus the word, so colour is never the only signal. */
export function Tag({ value }: { value: Watch | Status }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs whitespace-nowrap ${TAG_TONE[value]}`}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {value}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="border-line text-ink-faint rounded border px-1.5 py-px font-sans text-[11px] leading-4">
      {children}
    </kbd>
  );
}
