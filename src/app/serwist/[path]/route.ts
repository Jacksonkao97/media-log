import { randomUUID } from "node:crypto";
import { createSerwistRoute } from "@serwist/turbopack";

/* Builds and serves the service worker (src/sw/sw.ts) at /serwist/sw.js,
 * with the list of build files to precache injected. Static: built once at
 * `next build`. */

// "/" is precached as the app shell. A new revision each build makes every
// deploy re-fetch it (and changes sw.js, so browsers pick up the update).
const revision = randomUUID();

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } =
  createSerwistRoute({
    swSrc: "src/sw/sw.ts",
    useNativeEsbuild: true,
    additionalPrecacheEntries: [{ url: "/", revision }],
  });
