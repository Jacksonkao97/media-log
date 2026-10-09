import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MediaLog } from "@/components/MediaLog";
import { tmdbKey } from "@/lib/discover/tmdb";
import { trackPublicKey } from "@/lib/track/config";
import { syncConfigured } from "@/lib/sync/config";
import { DEFAULT_VIEW, parseView, viewPaths, viewTitle } from "@/lib/view";

/* One prerendered page per view (/, /cn, /discover/season, …; see lib/view.ts),
 * so the first paint already shows the right region or feed. Any other path
 * is a 404, and so is 电影 while TMDB isn't configured. */
export const dynamicParams = false;

const moviesEnabled = () => tmdbKey() !== null;

export function generateStaticParams() {
  return viewPaths(moviesEnabled()).map((p) => ({
    view: p.split("/").filter(Boolean),
  }));
}

async function viewOf(params: PageProps<"/[[...view]]">["params"]) {
  const { view } = await params;
  const shown = parseView(`/${(view ?? []).join("/")}`);
  if (!shown) notFound();
  if ("feed" in shown && shown.feed === "movies" && !moviesEnabled())
    notFound();
  return { ...DEFAULT_VIEW, ...shown };
}

export async function generateMetadata({
  params,
}: PageProps<"/[[...view]]">): Promise<Metadata> {
  return { title: viewTitle(await viewOf(params)) };
}

export default async function Page({ params }: PageProps<"/[[...view]]">) {
  return (
    <MediaLog
      initialView={await viewOf(params)}
      syncEnabled={syncConfigured()}
      moviesEnabled={moviesEnabled()}
      pushKey={trackPublicKey()}
    />
  );
}
