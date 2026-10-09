import type { ReactNode } from "react";
import { motion } from "motion/react";
import { ExternalLink, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { progNum } from "@/lib/items";
import { fmtDate, relDate } from "@/lib/format";
import type { Item } from "@/lib/schema";
import { cn } from "@/lib/utils";
import { CategoryTile, Tag } from "./media";

/* Phone: tile · title · progress. Desktop adds status and last-updated columns. */
const GRID =
  "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 md:grid-cols-[auto_minmax(0,1fr)_10rem_5.5rem_5.5rem] md:gap-x-5";

/** The row that just changed (added, saved, +1, restored). `key` restarts the highlight on repeat changes. */
export type Flash = { id: string; key: number } | null;

interface Props {
  items: Item[];
  flash: Flash;
  onEdit: (item: Item) => void;
  onBump: (item: Item) => void;
}

/* Desktop: the rows scroll inside the card, under a fixed column header,
 * once the list is taller than the space MediaLog leaves it. */
export function ItemList({ items, flash, onEdit, onBump }: Props) {
  return (
    <div className="bg-card overflow-hidden rounded-xl border md:flex md:min-h-0 md:flex-col">
      <div
        aria-hidden
        className={cn(
          GRID,
          "text-faint border-b px-4 py-2.5 text-xs font-medium max-md:hidden",
        )}
      >
        <span className="w-9" />
        <span>名称</span>
        <span>进度</span>
        <span>状态</span>
        <span>更新</span>
      </div>
      <ul className="divide-divider divide-y md:min-h-0 md:overflow-y-auto">
        {items.map((it) => (
          <Row
            key={it.id}
            item={it}
            flashKey={flash?.id === it.id ? flash.key : null}
            onEdit={onEdit}
            onBump={onBump}
          />
        ))}
      </ul>
    </div>
  );
}

function Row({
  item: it,
  flashKey,
  onEdit,
  onBump,
}: { item: Item; flashKey: number | null } & Pick<Props, "onEdit" | "onBump">) {
  // Only plain web links become clickable; anything else (javascript:, data:)
  // could have arrived through an imported file.
  const href = /^https?:\/\//i.test(it.url) ? it.url : null;
  const canBump = progNum(it.progress) !== null;

  return (
    <li
      className={cn(
        GRID,
        "group hover:bg-accent/50 relative px-4 py-3 transition-colors max-md:py-3.5",
      )}
    >
      {flashKey !== null && (
        <motion.span
          key={flashKey}
          aria-hidden
          className="bg-primary/12 pointer-events-none absolute inset-0"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 1.4, ease: "easeOut" }}
        />
      )}
      {/* The whole row opens the editor; the link and +1 sit above this layer. */}
      <button
        type="button"
        onClick={() => onEdit(it)}
        aria-label={`编辑「${it.name}」`}
        className="focus-visible:ring-ring/50 absolute inset-0 cursor-pointer outline-none focus-visible:ring-[3px] focus-visible:ring-inset"
      />

      <CategoryTile category={it.category} />

      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="line-clamp-2 text-[15px] leading-snug font-medium">
            {it.name}
          </span>
          {href && (
            <Button
              asChild
              variant="ghost"
              size="icon-sm"
              className="text-faint hover:text-primary relative z-10 size-7 max-md:size-9"
            >
              <a
                href={href}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={`打开「${it.name}」的链接`}
                title={href}
              >
                <ExternalLink aria-hidden className="size-3.5" />
              </a>
            </Button>
          )}
        </div>
        {it.note && (
          <p className="text-muted-foreground mt-0.5 line-clamp-1 text-[13px] max-md:line-clamp-2">
            {it.note}
          </p>
        )}
        <p className="text-faint mt-1 flex items-center gap-2 text-xs md:hidden">
          <Tag value={it.status} />
          <span aria-hidden>·</span>
          <span>{relDate(it.updatedAt)}</span>
        </p>
      </div>

      <div className="flex items-center justify-end gap-2.5 md:justify-between">
        <div className="flex flex-col items-end gap-0.5 md:items-start">
          <Progress value={it.progress} rollKey={flashKey} />
          <Tag value={it.watch} />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onBump(it)}
          aria-label={`「${it.name}」进度 +1`}
          title="进度 +1"
          className={cn(
            "text-muted-foreground hover:border-primary hover:text-primary relative z-10 min-w-10 px-2 text-xs font-semibold tabular-nums active:scale-95 max-md:h-10 max-md:min-w-11",
            !canBump && "invisible",
          )}
        >
          +1
        </Button>
      </div>

      <div className="max-md:hidden">
        <Tag value={it.status} />
      </div>
      <time
        dateTime={it.updatedAt}
        title={fmtDate(it.updatedAt)}
        className="text-faint text-xs tabular-nums max-md:hidden"
      >
        {relDate(it.updatedAt)}
      </time>
    </li>
  );
}

/** The progress text. In the row that just changed it rolls up into place
 *  (e.g. after +1); every other row renders a plain span, so 700 rows cost
 *  nothing extra. */
function Progress({
  value,
  rollKey,
}: {
  value: string;
  rollKey: number | null;
}) {
  const className = cn(
    "block text-[15px] leading-tight font-semibold tabular-nums",
    !value && "text-faint font-normal",
  );
  const text = value || "—";
  return (
    <span className="inline-flex overflow-hidden">
      {rollKey === null ? (
        <span className={className}>{text}</span>
      ) : (
        <motion.span
          key={rollKey}
          initial={{ y: "80%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", bounce: 0.25, duration: 0.45 }}
          className={className}
        >
          {text}
        </motion.span>
      )}
    </span>
  );
}

export function ListSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="加载中"
      className="bg-card rounded-xl border"
    >
      {Array.from({ length: 8 }, (_, i) => (
        <div
          key={i}
          className="border-divider flex items-center gap-4 border-b px-4 py-3.5 last:border-0"
        >
          <Skeleton className="size-9 rounded-lg" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-8 w-16 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  children,
  actions,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <Empty className="border py-16">
        <EmptyHeader>
          <EmptyMedia
            variant="icon"
            className="bg-primary-soft text-primary size-12 rounded-2xl"
          >
            <Icon aria-hidden />
          </EmptyMedia>
          <EmptyTitle>{title}</EmptyTitle>
          {children && <EmptyDescription>{children}</EmptyDescription>}
        </EmptyHeader>
        {actions && (
          <EmptyContent className="flex-row flex-wrap justify-center">
            {actions}
          </EmptyContent>
        )}
      </Empty>
    </motion.div>
  );
}
