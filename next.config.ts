import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

const nextConfig: NextConfig = {};

// Keeps esbuild (which compiles the service worker) out of the server bundle.
export default withSerwist(nextConfig);
