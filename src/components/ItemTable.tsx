import type { SortDir, SortKey } from "@/lib/items";
import { fmtDate } from "@/lib/format";
import type { Item } from "@/lib/schema";
import { Pill } from "./ui";

const COLUMNS: { key: SortKey; label: string; className: string }[] = [
  { key: "name", label: "名称", className: "w-[42%]" },
  { key: "progress", label: "进度", className: "w-[148px] max-[720px]:w-auto" },
  { key: "status", label: "状态", className: "w-[92px] max-[720px]:hidden" },
  { key: "category", label: "分类", className: "w-[88px] max-[720px]:hidden" },
  {
    key: "createdAt",
    label: "创建时间",
    className: "w-[108px] max-[720px]:hidden",
  },
  {
    key: "updatedAt",
    label: "更新时间",
    className: "w-[108px] max-[720px]:hidden",
  },
];

const ARROW = { asc: "↑", desc: "↓" };

interface Props {
  items: Item[];
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  onEdit: (item: Item) => void;
}

export function ItemTable({ items, sortKey, sortDir, onSort, onEdit }: Props) {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          {COLUMNS.map((c) => {
            const on = c.key === sortKey;
            return (
              <th
                key={c.key}
                aria-sort={
                  on
                    ? sortDir === "asc"
                      ? "ascending"
                      : "descending"
                    : undefined
                }
                className={`border-line bg-page sticky top-(--head-h) z-20 border-b p-0 text-left ${c.className}`}
              >
                <button
                  onClick={() => onSort(c.key)}
                  className="text-ink-faint hover:text-ink w-full cursor-pointer px-2.5 py-[9px] text-left text-[11px] font-semibold tracking-[.06em] whitespace-nowrap uppercase select-none"
                >
                  {c.label}
                  <span
                    aria-hidden
                    className={`ml-[5px] text-[10px] ${on ? "text-accent" : "opacity-30"}`}
                  >
                    {on ? ARROW[sortDir] : "↕"}
                  </span>
                </button>
              </th>
            );
          })}
          <th className="border-line bg-page sticky top-(--head-h) z-20 w-11 border-b" />
        </tr>
      </thead>
      <tbody>
        {items.map((it) => (
          <Row key={it.id} item={it} onEdit={onEdit} />
        ))}
      </tbody>
    </table>
  );
}

function Row({
  item: it,
  onEdit,
}: {
  item: Item;
  onEdit: (item: Item) => void;
}) {
  // Only plain web links become clickable; anything else (javascript:, data:)
  // could have arrived through an imported file.
  const href = /^https?:\/\//i.test(it.url) ? it.url : null;
  return (
    <tr className="group border-line-soft hover:bg-panel border-b">
      <td className="px-2.5 py-2 align-top">
        <div className="font-medium break-words">
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className="border-accent-dim hover:text-accent border-b"
            >
              {it.name}
            </a>
          ) : (
            it.name
          )}
        </div>
        {it.note && (
          <div className="text-ink-faint mt-0.5 text-xs break-words">
            {it.note}
          </div>
        )}
        {/* Status and category columns are hidden on narrow screens; show them here instead. */}
        <div className="mt-1 flex gap-1 min-[721px]:hidden">
          <Pill value={it.status} />
          <Pill value={it.category} />
        </div>
      </td>
      <td className="px-2.5 py-2 align-top">
        <div className="flex flex-wrap items-baseline gap-[7px]">
          <span
            className={`font-mono text-[13px] leading-[1.4] ${it.progress ? "text-ink" : "text-ink-faint"}`}
          >
            {it.progress || "—"}
          </span>
          <Pill value={it.watch} />
        </div>
      </td>
      <td className="px-2.5 py-2 align-top max-[720px]:hidden">
        <Pill value={it.status} />
      </td>
      <td className="px-2.5 py-2 align-top max-[720px]:hidden">
        <Pill value={it.category} />
      </td>
      <td className="text-ink-faint px-2.5 py-2 align-top font-mono text-xs whitespace-nowrap max-[720px]:hidden">
        {fmtDate(it.createdAt)}
      </td>
      <td className="text-ink-faint px-2.5 py-2 align-top font-mono text-xs whitespace-nowrap max-[720px]:hidden">
        {fmtDate(it.updatedAt)}
      </td>
      <td className="px-1 py-1.5 align-top">
        {/* Hidden until row hover on mouse devices; always visible on touch screens. */}
        <button
          onClick={() => onEdit(it)}
          title="编辑"
          aria-label={`编辑 ${it.name}`}
          className="text-ink-faint hover:bg-raised hover:text-accent cursor-pointer rounded-md px-[7px] py-[3px] text-[13px] transition-opacity group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:hover)]:opacity-0"
        >
          ✎
        </button>
      </td>
    </tr>
  );
}
