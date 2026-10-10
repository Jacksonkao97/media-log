"use client";

/* 发现: this week's airing anime, a season's new anime, trending manga and
 * movies, from AniList and TMDB through /api/discover. Tapping a work adds it
 * to the library: the editor opens with name, category, region, status and
 * link filled in. Works already in the library show their watch state, and
 * tapping one opens its entry instead. */

import { useMemo, useState, type ReactNode } from "react";
import {
  BookOpen,
  CalendarClock,
  Check,
  Clapperboard,
  CloudOff,
  ExternalLink,
  Plus,
  RotateCw,
  Sparkles,
  Star,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Toggle } from "@/components/ui/toggle";
import {
  FEED_LABEL,
  MANGA_COUNTRIES,
  MOVIE_LISTS,
  feedUrl,
  seasonLabel,
  seasonOf,
  shiftSeason,
  type FeedId,
  type MangaCountry,
  type MovieList,
} from "@/lib/discover/feeds";
import { libraryLookup, type Owned } from "@/lib/discover/match";
import {
  airingNote,
  airingOn,
  clock,
  timetableDays,
} from "@/lib/discover/schedule";
import type { Airing, FeedData, Work } from "@/lib/discover/types";
import type { Library } from "@/lib/schema";
import { cn } from "@/lib/utils";
import { EmptyState, ListSkeleton } from "./ItemList";
import { CATEGORY, Tag } from "./media";
import { Segmented } from "./Segmented";
import { useFeed } from "./useFeed";

export const FEEDS: Record<
  FeedId,
  { label: string; short: string; icon: LucideIcon; blurb: string }
> = {
  airing: {
    label: FEED_LABEL.airing,
    short: "时间表",
    icon: CalendarClock,
    blurb: "这一周每天更新的动画，按你的时区排",
  },
  season: {
    label: FEED_LABEL.season,
    short: "新番",
    icon: Sparkles,
    blurb: "一季开播的动画，按人气排",
  },
  manga: {
    label: FEED_LABEL.manga,
    short: "漫画",
    icon: BookOpen,
    blurb: "最近最多人在看的漫画",
  },
  movies: {
    label: FEED_LABEL.movies,
    short: "电影",
    icon: Clapperboard,
    blurb: "正在上映和即将上映的电影",
  },
};

/** Tapping a work: open its library entry if it has one, else add it. */
export type PickWork = (work: Work, owned: Owned | null) => void;

interface View {
  lookup: (w: Work) => Owned | null;
  onPick: PickWork;
}

export function Discover({
  feed,
  library,
  moviesEnabled,
  onPick,
}: {
  feed: FeedId;
  library: Library | null;
  moviesEnabled: boolean;
  onPick: PickWork;
}) {
  const lookup = useMemo(
    () => (library ? libraryLookup(library) : () => null),
    [library],
  );
  const view = { lookup, onPick };
  const { label, blurb } = FEEDS[feed];
  return (
    <>
      {/* Phones name the feed in the top bar's tabs. */}
      <div className="mb-4 max-md:sr-only">
        <h1 className="text-2xl font-semibold tracking-tight">{label}</h1>
        <p className="text-muted-foreground mt-0.5 text-sm">{blurb}</p>
      </div>
      {feed === "airing" && <AiringFeed {...view} />}
      {feed === "season" && <SeasonFeed {...view} />}
      {feed === "manga" && <MangaFeed {...view} />}
      {feed === "movies" &&
        (moviesEnabled ? <MovieFeed {...view} /> : <MoviesNotSetUp />)}
      {(feed !== "movies" || moviesEnabled) && (
        <Credit tmdb={feed === "movies"} />
      )}
    </>
  );
}

/* --------------------------------------------------------------- feeds */

function AiringFeed({ lookup, onPick }: View) {
  const feed = useFeed(feedUrl({ feed: "airing" }));
  // Fixed while the feed is open; nothing here needs to tick.
  const [now] = useState(() => Date.now());
  const days = useMemo(() => timetableDays(new Date(now)), [now]);
  const [label, setLabel] = useState(days[1].label); // 今天
  const day = days.find((d) => d.label === label) ?? days[1];
  const [mine, setMine] = useState(false);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {/* Phones scroll the seven days sideways. */}
        <div className="-mx-4 max-w-[calc(100%+2rem)] overflow-x-auto px-4 md:mx-0 md:max-w-full md:px-0">
          <Segmented
            label="日期"
            value={label}
            options={days.map((d) => d.label)}
            onChange={setLabel}
            className="w-max"
            render={(l) => (
              <>
                {l}
                <span className="text-faint text-xs tabular-nums">
                  {days.find((d) => d.label === l)!.date}
                </span>
              </>
            )}
          />
        </div>
        <Toggle
          variant="outline"
          pressed={mine}
          onPressedChange={setMine}
          className="text-muted-foreground data-[state=on]:border-primary/50 data-[state=on]:bg-primary-soft data-[state=on]:text-foreground h-8 rounded-full px-3 text-[13px] font-normal shadow-none max-md:h-10 max-md:px-3.5"
        >
          <Check aria-hidden />
          只看片单里的
        </Toggle>
      </div>
      <FeedBody feed={feed} skeleton={<ListSkeleton />}>
        {(data) => {
          const all = data.kind === "airing" ? airingOn(data.airing, day) : [];
          const list = mine ? all.filter((a) => lookup(a.work)) : all;
          if (!list.length)
            return (
              <EmptyState
                icon={CalendarClock}
                title={
                  mine && all.length
                    ? "片单里的动画这天都不更新"
                    : "这一天没有动画更新"
                }
              >
                {mine && all.length
                  ? `这天有 ${all.length} 部更新，关掉「只看片单里的」可以看到。`
                  : undefined}
              </EmptyState>
            );
          return (
            <ul className="bg-card divide-divider divide-y overflow-hidden rounded-xl border">
              {list.map((a) => (
                <AiringRow
                  key={`${a.work.key}:${a.episode}`}
                  airing={a}
                  owned={lookup(a.work)}
                  now={now}
                  onPick={onPick}
                />
              ))}
            </ul>
          );
        }}
      </FeedBody>
    </>
  );
}

function SeasonFeed(view: View) {
  const [now] = useState(() => new Date());
  const seasons = useMemo(
    () => [-1, 0, 1].map((i) => shiftSeason(seasonOf(now), i)),
    [now],
  );
  const labels = seasons.map(seasonLabel);
  const [label, setLabel] = useState(labels[1]);
  const season = seasons[labels.indexOf(label)];
  const feed = useFeed(feedUrl({ feed: "season", season }));
  return (
    <>
      <Segmented
        label="季度"
        value={label}
        options={labels}
        onChange={setLabel}
        className="mb-4 md:w-fit"
        render={(l) => (
          <>
            {l}
            {l === labels[1] && (
              <span className="text-faint text-xs">本季</span>
            )}
          </>
        )}
      />
      <WorkGrid feed={feed} empty="这一季还没有公布作品" {...view} />
    </>
  );
}

const COUNTRY_BY_LABEL = Object.fromEntries(
  Object.entries(MANGA_COUNTRIES).map(([code, label]) => [label, code]),
) as Record<string, MangaCountry>;

function MangaFeed(view: View) {
  const [label, setLabel] = useState<string>(MANGA_COUNTRIES.JP);
  const feed = useFeed(
    feedUrl({ feed: "manga", country: COUNTRY_BY_LABEL[label] }),
  );
  return (
    <>
      <Segmented
        label="国家"
        value={label}
        options={Object.values(MANGA_COUNTRIES)}
        onChange={setLabel}
        className="mb-4 md:w-fit"
      />
      <WorkGrid feed={feed} empty="暂时没有数据" {...view} />
    </>
  );
}

const LIST_BY_LABEL = Object.fromEntries(
  Object.entries(MOVIE_LISTS).map(([id, label]) => [label, id]),
) as Record<string, MovieList>;

function MovieFeed(view: View) {
  const [label, setLabel] = useState<string>(MOVIE_LISTS.now_playing);
  const feed = useFeed(feedUrl({ feed: "movies", list: LIST_BY_LABEL[label] }));
  return (
    <>
      <Segmented
        label="榜单"
        value={label}
        options={Object.values(MOVIE_LISTS)}
        onChange={setLabel}
        className="mb-4 md:w-fit"
      />
      <WorkGrid feed={feed} empty="暂时没有数据" {...view} />
    </>
  );
}

function MoviesNotSetUp() {
  return (
    <EmptyState icon={Clapperboard} title="电影资讯还没有配置">
      电影数据来自 TMDB，需要一个免费的 API key：在服务器上设置环境变量
      TMDB_API_KEY，步骤见 README「新番 / 电影资讯」。
    </EmptyState>
  );
}

/* --------------------------------------------------------------- parts */

/** Loading, failure (with 重试), or the data. */
function FeedBody({
  feed,
  skeleton,
  children,
}: {
  feed: ReturnType<typeof useFeed>;
  skeleton: ReactNode;
  children: (data: FeedData) => ReactNode;
}) {
  if (feed.status === "loading") return skeleton;
  if (feed.status === "error")
    return (
      <EmptyState
        icon={CloudOff}
        title="加载失败"
        actions={
          <Button variant="outline" onClick={feed.reload}>
            <RotateCw aria-hidden />
            重试
          </Button>
        }
      >
        {feed.message}
      </EmptyState>
    );
  return children(feed.data);
}

function WorkGrid({
  feed,
  empty,
  lookup,
  onPick,
}: View & { feed: ReturnType<typeof useFeed>; empty: string }) {
  return (
    <FeedBody feed={feed} skeleton={<GridSkeleton />}>
      {(data) =>
        data.kind === "works" && data.works.length ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {data.works.map((w) => (
              <WorkCard
                key={w.key}
                work={w}
                owned={lookup(w)}
                onPick={onPick}
              />
            ))}
          </ul>
        ) : (
          <EmptyState icon={Sparkles} title={empty} />
        )
      }
    </FeedBody>
  );
}

/* The whole row or card is one button (add, or open the entry); the source
 * link sits above it. Everything else is pointer-events-none or unpositioned,
 * so taps fall through to the button. */
function PickButton({
  work,
  owned,
  onPick,
}: {
  work: Work;
  owned: Owned | null;
  onPick: PickWork;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(work, owned)}
      aria-label={
        owned
          ? `打开片单里的「${owned.item.name}」`
          : `把「${work.title}」加入片单`
      }
      data-track={owned ? "打开片单里的作品" : "从发现加入片单"}
      className="focus-visible:ring-ring/50 absolute inset-0 cursor-pointer rounded-[inherit] outline-none focus-visible:ring-[3px] focus-visible:ring-inset"
    />
  );
}

function AiringRow({
  airing: a,
  owned,
  now,
  onPick,
}: {
  airing: Airing;
  owned: Owned | null;
  now: number;
  onPick: PickWork;
}) {
  const w = a.work;
  const note = airingNote(a.airingAt, now);
  const aired = note === "已更新";
  return (
    <li className="hover:bg-accent/50 relative grid grid-cols-[2.75rem_2.5rem_minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-3 transition-colors">
      <PickButton work={w} owned={owned} onPick={onPick} />
      <time
        dateTime={new Date(a.airingAt * 1000).toISOString()}
        className={cn(
          "text-[15px] font-semibold tabular-nums",
          aired && "text-muted-foreground font-medium",
        )}
      >
        {clock(a.airingAt)}
      </time>
      <Cover work={w} className="w-10 rounded-md" />
      <div className="min-w-0">
        <Title work={w} />
        <p className="text-muted-foreground mt-0.5 text-[13px] tabular-nums">
          第 {a.episode} 集
          {w.total ? <span className="text-faint"> / {w.total}</span> : null}
          {note && (
            <span className={aired ? "text-green" : "text-faint"}>
              {" "}
              · {note}
            </span>
          )}
        </p>
      </div>
      <Mark owned={owned} />
    </li>
  );
}

function WorkCard({
  work: w,
  owned,
  onPick,
}: {
  work: Work;
  owned: Owned | null;
  onPick: PickWork;
}) {
  return (
    <li className="group bg-card hover:border-primary/40 relative flex flex-col overflow-hidden rounded-xl border transition-colors">
      <PickButton work={w} owned={owned} onPick={onPick} />
      <div className="pointer-events-none relative">
        <Cover work={w} className="w-full" />
        {w.score !== null && (
          <span className="bg-background/85 absolute top-2 left-2 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums backdrop-blur-sm">
            <Star aria-hidden className="text-amber size-3 fill-current" />
            {w.score.toFixed(1)}
          </span>
        )}
        <span className="absolute right-2 bottom-2">
          {owned ? (
            <span className="bg-background/90 inline-flex items-center gap-1.5 rounded-full py-1 pr-2.5 pl-2 shadow-sm backdrop-blur-sm">
              <Tag value={owned.item.watch} />
            </span>
          ) : (
            <span className="bg-background/90 text-muted-foreground group-hover:text-primary inline-flex size-8 items-center justify-center rounded-full shadow-sm backdrop-blur-sm">
              <Plus aria-hidden className="size-4" />
            </span>
          )}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <Title work={w} className="text-sm" />
        {meta(w).map((line) => (
          <p key={line} className="text-faint line-clamp-1 text-xs">
            {line}
          </p>
        ))}
      </div>
    </li>
  );
}

/** Title, with the AniList / TMDB page one tap away. */
function Title({ work, className }: { work: Work; className?: string }) {
  const site = work.key.startsWith("tmdb:") ? "TMDB" : "AniList";
  return (
    <div className="flex items-start gap-1">
      <span
        title={work.subtitle || undefined}
        className={cn(
          "line-clamp-2 text-[15px] leading-snug font-medium",
          className,
        )}
      >
        {work.title}
      </span>
      {/^https:\/\//.test(work.url) && (
        <Button
          asChild
          variant="ghost"
          size="icon-sm"
          className="text-faint hover:text-primary relative z-10 -my-1 size-7 shrink-0 max-md:-my-2 max-md:size-9"
        >
          <a
            href={work.url}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={`在 ${site} 查看「${work.title}」`}
            data-track={`在 ${site} 查看`}
            title={`在 ${site} 查看`}
          >
            <ExternalLink aria-hidden className="size-3.5" />
          </a>
        </Button>
      )}
    </div>
  );
}

/** In the library: its watch state. Otherwise a + that says tapping adds it. */
function Mark({ owned }: { owned: Owned | null }) {
  if (owned)
    return (
      <span className="flex flex-col items-end gap-1">
        <span className="text-primary inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap">
          <Check aria-hidden className="size-3.5" />
          在片单
        </span>
        <Tag value={owned.item.watch} />
      </span>
    );
  return (
    <span
      aria-hidden
      className="text-muted-foreground inline-flex size-9 items-center justify-center rounded-full border"
    >
      <Plus className="size-4" />
    </span>
  );
}

const HEX = /^#[0-9a-f]{6}$/i;

/** The cover image, on its average colour while loading; the category icon
 *  when there is none or it fails. */
function Cover({ work, className }: { work: Work; className?: string }) {
  const [failed, setFailed] = useState(false);
  const Icon = CATEGORY[work.category].icon;
  const color = work.color && HEX.test(work.color) ? work.color : undefined;
  const src = work.image?.startsWith("https://") ? work.image : null;
  return (
    <span
      style={color ? { backgroundColor: color } : undefined}
      className={cn(
        "bg-muted pointer-events-none flex aspect-[2/3] shrink-0 items-center justify-center overflow-hidden",
        className,
      )}
    >
      {src && !failed ? (
        // Straight from AniList's / TMDB's CDN: next/image would only proxy
        // (and bill) them through this server.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      ) : (
        <Icon aria-hidden className="text-faint size-1/3" />
      )}
    </span>
  );
}

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

/** "2026-10-04" → "10月4日"; partial dates as far as they go. */
function day(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const year = y === new Date().getFullYear() ? "" : `${y}年`;
  if (!m) return `${y}年`;
  return d ? `${year}${m}月${d}日` : `${y}年${m}月`;
}

const PHASE_LABEL: Record<"动画" | "漫画", Record<Work["phase"], string>> = {
  动画: {
    upcoming: "未开播",
    releasing: "放送中",
    hiatus: "停播中",
    finished: "已完结",
    cancelled: "已中止",
  },
  漫画: {
    upcoming: "未开始",
    releasing: "连载中",
    hiatus: "休刊中",
    finished: "已完结",
    cancelled: "已腰斩",
  },
};

/** The lines under a card's title. */
function meta(w: Work): string[] {
  if (w.category === "漫画") {
    const parts = [PHASE_LABEL.漫画[w.phase]];
    if (w.total) parts.push(`${w.total} 话`);
    return [parts.join(" · ")];
  }
  if (w.key.startsWith("tmdb:")) {
    return [w.date ? `${day(w.date)}上映` : "上映日期未定"];
  }
  // AniList anime, including 剧场版.
  const movie = w.category === "电影";
  const first = [w.format, !movie && w.total ? `${w.total} 集` : ""]
    .filter(Boolean)
    .join(" · ");
  let second: string;
  if (w.phase === "releasing" && w.next) {
    const at = new Date(w.next.airingAt * 1000);
    second = `${WEEKDAYS[at.getDay()]} ${clock(w.next.airingAt)} 更新第 ${w.next.episode} 集`;
  } else if (w.phase === "upcoming") {
    second = w.date ? `${day(w.date)}${movie ? "上映" : "开播"}` : "即将开播";
  } else {
    second = PHASE_LABEL.动画[w.phase];
  }
  return [first, second].filter(Boolean);
}

function GridSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="加载中"
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
    >
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} className="bg-card overflow-hidden rounded-xl border">
          <Skeleton className="aspect-[2/3] rounded-none" />
          <div className="flex flex-col gap-2 p-3">
            <Skeleton className="h-3.5 w-4/5" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Sources, as their terms ask. TMDB's API terms (§3) require its logo, kept
 *  less prominent than the app's own, and this notice verbatim. The logo is
 *  TMDB's official "primary long" SVG (themoviedb.org/about/logos-attribution). */
function Credit({ tmdb }: { tmdb: boolean }) {
  if (tmdb) {
    return (
      <div className="text-faint mt-6 flex flex-col items-start gap-2 text-xs leading-relaxed">
        <a
          href="https://www.themoviedb.org"
          target="_blank"
          rel="noreferrer noopener"
          aria-label="TMDB"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- a 2 KB SVG */}
          <img src="/credits/tmdb.svg" alt="TMDB" className="h-3 w-auto" />
        </a>
        <p>
          电影数据来自 TMDB。This website uses TMDB and the TMDB APIs but is not
          endorsed, certified, or otherwise approved by TMDB.
        </p>
      </div>
    );
  }
  return (
    <p className="text-faint mt-6 text-xs leading-relaxed">
      数据来自{" "}
      <a
        href="https://anilist.co"
        target="_blank"
        rel="noreferrer noopener"
        className="hover:text-foreground underline underline-offset-2"
      >
        AniList
      </a>
    </p>
  );
}
