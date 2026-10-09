import { Fragment, type Ref } from "react";
import type { Filters } from "@/lib/items";
import { CATEGORIES, STATUSES, WATCHES } from "@/lib/schema";
import { Button } from "./ui";

const GROUPS = [
  ["category", CATEGORIES],
  ["status", STATUSES],
  ["watch", WATCHES],
] as const;

interface Props {
  ref?: Ref<HTMLInputElement>;
  query: string;
  filters: Filters;
  stats: {
    shown: number;
    total: number;
    watching: number;
    done: number;
    unseen: number;
  };
  onQuery: (q: string) => void;
  onToggle: (kind: keyof Filters, value: string) => void;
  onClear: () => void;
}

export function Toolbar({
  ref,
  query,
  filters,
  stats,
  onQuery,
  onToggle,
  onClear,
}: Props) {
  const active = Boolean(query) || Object.values(filters).some((s) => s.size);

  return (
    <section className="border-line-soft flex flex-wrap items-center gap-2.5 border-b px-[18px] py-[11px] max-[720px]:px-3">
      <input
        ref={ref}
        type="search"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder="搜索名称或备注…"
        autoComplete="off"
        className="border-line bg-panel text-ink placeholder:text-ink-faint focus:border-accent w-[250px] rounded-lg border px-[11px] py-1.5 text-[13px] focus:outline-none max-[720px]:w-full"
      />

      <div className="flex flex-wrap items-center gap-[5px]">
        {GROUPS.map(([kind, values], i) => (
          <Fragment key={kind}>
            {i > 0 && <i className="bg-line mx-1 h-4 w-px" />}
            {values.map((v) => {
              const on = (filters[kind] as Set<string>).has(v);
              return (
                <button
                  key={v}
                  aria-pressed={on}
                  onClick={() => onToggle(kind, v)}
                  className={`cursor-pointer rounded-full border px-2.5 py-1 text-xs ${
                    on
                      ? "border-accent bg-accent-dim text-ink"
                      : "border-line text-ink-dim hover:border-ink-faint hover:text-ink"
                  }`}
                >
                  {v}
                </button>
              );
            })}
          </Fragment>
        ))}
      </div>

      {active && (
        <Button variant="ghost" small onClick={onClear}>
          清除筛选
        </Button>
      )}
      <div className="flex-1" />
      <div className="text-ink-faint [&_b]:text-ink-dim font-mono text-xs leading-none [&_b]:font-semibold">
        <b>{stats.shown}</b>/{stats.total} · 看着 <b>{stats.watching}</b> ·
        看完了 <b>{stats.done}</b> · 未看 <b>{stats.unseen}</b>
      </div>
    </section>
  );
}
