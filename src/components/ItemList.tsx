import type { ReactNode } from "react";
import { ExternalLink, type LucideIcon } from "lucide-react";
import { progNum } from "@/lib/items";
import { fmtDate, relDate } from "@/lib/format";
import type { Item } from "@/lib/schema";
import { CategoryTile, Tag } from "./ui";

/* Phone: tile · title · progress. Desktop adds status and last-updated columns. */
const GRID =
  "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 md:grid-cols-[auto_minmax(0,1fr)_10rem_5.5rem_5.5rem] md:gap-x-5";

interface Props {
  items: Item[];
  onEdit: (item: Item) => void;
  onBump: (item: Item) => void;
}

export function ItemList({ items, onEdit, onBump }: Props) {
  return (
    <div className="border-line bg-panel overflow-hidden rounded-xl border">
      <div
        aria-hidden
        className={`${GRID} border-line text-ink-faint border-b px-4 py-2.5 text-xs font-medium max-md:hidden`}
      >
        <span className="w-9" />
        <span>名称</span>
        <span>进度</span>
        <span>状态</span>
        <span>更新</span>
      </div>
      <ul className="divide-line-soft divide-y">
        {items.map((it) => (
          <Row key={it.id} item={it} onEdit={onEdit} onBump={onBump} />
        ))}
      </ul>
    </div>
  );
}

function Row({
  item: it,
  onEdit,
  onBump,
}: { item: Item } & Omit<Props, "items">) {
  // Only plain web links become clickable; anything else (javascript:, data:)
  // could have arrived through an imported file.
  const href = /^https?:\/\//i.test(it.url) ? it.url : null;
  const canBump = progNum(it.progress) !== null;

  return (
    <li
      className={`${GRID} group hover:bg-raised/50 relative px-4 py-3 transition-colors max-md:py-3.5`}
    >
      {/* The whole row opens the editor; the link and +1 sit above this layer. */}
      <button
        type="button"
        onClick={() => onEdit(it)}
        aria-label={`编辑「${it.name}」`}
        className="absolute inset-0 cursor-pointer focus-visible:-outline-offset-2"
      />

      <CategoryTile category={it.category} />

      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-ink line-clamp-2 text-[15px] leading-snug font-medium">
            {it.name}
          </span>
          {href && (
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              aria-label={`打开「${it.name}」的链接`}
              title={href}
              className="text-ink-faint hover:text-accent relative z-10 inline-flex size-7 shrink-0 items-center justify-center rounded-md max-md:size-9"
            >
              <ExternalLink aria-hidden className="size-3.5" />
            </a>
          )}
        </div>
        {it.note && (
          <p className="text-ink-dim mt-0.5 line-clamp-1 text-[13px] max-md:line-clamp-2">
            {it.note}
          </p>
        )}
        <p className="text-ink-faint mt-1 flex items-center gap-2 text-xs md:hidden">
          <Tag value={it.status} />
          <span aria-hidden>·</span>
          <span>{relDate(it.updatedAt)}</span>
        </p>
      </div>

      <div className="flex items-center justify-end gap-2.5 md:justify-between">
        <div className="flex flex-col items-end gap-0.5 md:items-start">
          <span
            className={`text-[15px] leading-tight font-semibold tabular-nums ${it.progress ? "text-ink" : "text-ink-faint font-normal"}`}
          >
            {it.progress || "—"}
          </span>
          <Tag value={it.watch} />
        </div>
        <button
          type="button"
          onClick={() => onBump(it)}
          aria-label={`「${it.name}」进度 +1`}
          title="进度 +1"
          className={`border-line text-ink-dim hover:border-accent hover:text-accent relative z-10 h-8 min-w-10 cursor-pointer rounded-lg border px-2 text-xs font-semibold tabular-nums transition active:scale-95 max-md:h-10 max-md:min-w-11 ${
            canBump ? "" : "invisible"
          }`}
        >
          +1
        </button>
      </div>

      <div className="max-md:hidden">
        <Tag value={it.status} />
      </div>
      <time
        dateTime={it.updatedAt}
        title={fmtDate(it.updatedAt)}
        className="text-ink-faint text-xs tabular-nums max-md:hidden"
      >
        {relDate(it.updatedAt)}
      </time>
    </li>
  );
}

export function ListSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="加载中"
      className="border-line bg-panel rounded-xl border"
    >
      {Array.from({ length: 8 }, (_, i) => (
        <div
          key={i}
          className="border-line-soft flex items-center gap-4 border-b px-4 py-3.5 last:border-0"
        >
          <span className="bg-raised size-9 animate-pulse rounded-lg" />
          <div className="flex flex-1 flex-col gap-2">
            <span className="bg-raised h-3.5 w-2/5 animate-pulse rounded" />
            <span className="bg-raised h-3 w-1/4 animate-pulse rounded" />
          </div>
          <span className="bg-raised h-8 w-16 animate-pulse rounded-lg" />
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
    <div className="border-line flex flex-col items-center rounded-xl border border-dashed px-6 py-16 text-center">
      <span className="bg-accent-dim text-accent inline-flex size-12 items-center justify-center rounded-2xl">
        <Icon aria-hidden className="size-6" />
      </span>
      <h2 className="mt-4 text-base font-semibold">{title}</h2>
      {children && (
        <p className="text-ink-dim mt-1.5 max-w-sm text-sm">{children}</p>
      )}
      {actions && (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}
