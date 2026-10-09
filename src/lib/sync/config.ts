/** True when the three env vars Google sign-in needs are all set (see src/auth.ts). */
export const syncConfigured = () =>
  Boolean(
    process.env.AUTH_SECRET &&
    process.env.AUTH_GOOGLE_ID &&
    process.env.AUTH_GOOGLE_SECRET,
  );
