import { MediaLog } from "@/components/MediaLog";
import { syncConfigured } from "@/lib/sync/config";

export default function Page() {
  return <MediaLog syncEnabled={syncConfigured()} />;
}
