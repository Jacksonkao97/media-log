import { MediaLog } from "@/components/MediaLog";
import { tmdbKey } from "@/lib/discover/tmdb";
import { syncConfigured } from "@/lib/sync/config";

export default function Page() {
  return (
    <MediaLog
      syncEnabled={syncConfigured()}
      moviesEnabled={tmdbKey() !== null}
    />
  );
}
