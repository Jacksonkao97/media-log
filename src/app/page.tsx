import { MediaLog } from "@/components/MediaLog";
import { tmdbKey } from "@/lib/discover/tmdb";
import { trackPublicKey } from "@/lib/track/config";
import { syncConfigured } from "@/lib/sync/config";

export default function Page() {
  return (
    <MediaLog
      syncEnabled={syncConfigured()}
      moviesEnabled={tmdbKey() !== null}
      pushKey={trackPublicKey()}
    />
  );
}
