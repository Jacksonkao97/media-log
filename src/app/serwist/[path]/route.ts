import { randomUUID } from "node:crypto";
import { createSerwistRoute } from "@serwist/turbopack";
import { tmdbKey } from "@/lib/discover/tmdb";
import { viewPaths } from "@/lib/view";

/* Builds and serves the service worker (src/sw/sw.ts) at /serwist/sw.js,
 * with the list of build files to precache injected. Static: built once at
 * `next build`. */

// Every view's page ("/", "/cn", "/discover/season", …; lib/view.ts, with
// 电影 only when TMDB is configured) is
// precached as the app shell. A new revision each build makes every deploy
// re-fetch them (and changes sw.js, so browsers pick up the update).
const revision = randomUUID();

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } =
  createSerwistRoute({
    swSrc: "src/sw/sw.ts",
    useNativeEsbuild: true,
    additionalPrecacheEntries: viewPaths(tmdbKey() !== null).map((url) => ({
      url,
      revision,
    })),
  });
