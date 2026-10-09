/* How the data model's values look. Both maps are typed by the enums in
 * lib/schema.ts, so adding a value there makes the compiler ask for one here. */

import { BookOpen, Film, Tv, type LucideIcon } from "lucide-react";
import type { Category, Status, Watch } from "@/lib/schema";
import { cn } from "@/lib/utils";

export const CATEGORY: Record<Category, { icon: LucideIcon; tone: string }> = {
  动画: { icon: Tv, tone: "bg-purple/12 text-purple" },
  漫画: { icon: BookOpen, tone: "bg-sky/12 text-sky" },
  电影: { icon: Film, tone: "bg-red/12 text-red" },
};

const TAG_TONE: Record<Watch | Status, string> = {
  未看: "text-faint",
  看着: "text-amber",
  看完了: "text-green",
  未完结: "text-sky",
  完结: "text-faint",
};

/** Category as a tinted icon tile. Shape, not just colour, tells them apart. */
export function CategoryTile({
  category,
  className,
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
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-lg",
        tone,
        className,
      )}
    >
      <Icon aria-hidden className="size-[18px]" />
    </span>
  );
}

/** Watch or series state: a coloured dot plus the word, so colour is never the only signal. */
export function Tag({ value }: { value: Watch | Status }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs whitespace-nowrap",
        TAG_TONE[value],
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {value}
    </span>
  );
}
