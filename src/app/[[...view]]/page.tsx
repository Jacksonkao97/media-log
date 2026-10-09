import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MediaLog } from "@/components/MediaLog";
import { tmdbKey } from "@/lib/discover/tmdb";
import { trackPublicKey } from "@/lib/track/config";
import { syncConfigured } from "@/lib/sync/config";
import { DEFAULT_VIEW, VIEW_PATHS, parseView, viewTitle } from "@/lib/view";

/* One prerendered page per view (/, /cn, /discover/season, …; see lib/view.ts),
 * so the first paint already shows the right region or feed. Any other path
 * is a 404. */
export const dynamicParams = false;

export function generateStaticParams() {
  return VIEW_PATHS.map((p) => ({ view: p.split("/").filter(Boolean) }));
}

async function viewOf(params: PageProps<"/[[...view]]">["params"]) {
  const { view } = await params;
  const shown = parseView(`/${(view ?? []).join("/")}`);
  if (!shown) notFound();
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
      moviesEnabled={tmdbKey() !== null}
      pushKey={trackPublicKey()}
    />
  );
}
