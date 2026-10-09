import { notFound } from "next/navigation";
import { MediaLog } from "@/components/MediaLog";
import { tmdbKey } from "@/lib/discover/tmdb";
import { trackPublicKey } from "@/lib/track/config";
import { syncConfigured } from "@/lib/sync/config";
import { DEFAULT_VIEW, VIEW_PATHS, parseView } from "@/lib/view";

/* One prerendered page per view (/, /cn, /discover/season, …; see lib/view.ts),
 * so the first paint already shows the right region or feed. Any other path
 * is a 404. */
export const dynamicParams = false;

export function generateStaticParams() {
  return VIEW_PATHS.map((p) => ({ view: p.split("/").filter(Boolean) }));
}

export default async function Page({ params }: PageProps<"/[[...view]]">) {
  const { view } = await params;
  const shown = parseView(`/${(view ?? []).join("/")}`);
  if (!shown) notFound();
  return (
    <MediaLog
      initialView={{ ...DEFAULT_VIEW, ...shown }}
      syncEnabled={syncConfigured()}
      moviesEnabled={tmdbKey() !== null}
      pushKey={trackPublicKey()}
    />
  );
}
