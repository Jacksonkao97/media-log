/* Google sign-in (Auth.js). No database: the session is an encrypted JWT
 * cookie holding Google's refresh token, which never reaches the browser.
 * The browser only ever sees a short-lived access token (via the session),
 * scoped to drive.file, and uses it to talk to Drive directly.
 *
 * Env: AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET (read automatically).
 * Self-hosting outside Vercel in production also needs AUTH_TRUST_HOST=true. */

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

export type AuthErrorCode = "RefreshTokenError" | "DriveScopeMissing";

export const { handlers, auth } = NextAuth({
  providers: [
    Google({
      authorization: {
        params: {
          scope: `openid email profile ${DRIVE_SCOPE}`,
          // A refresh token (offline access) is what lets sync keep working
          // after the 1-hour access token expires. `consent` makes Google
          // return one on every sign-in, not just the first.
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account, trigger, session }) {
      if (account) {
        // Just signed in. Google's consent screen lets people untick Drive.
        const granted = account.scope?.split(" ").includes(DRIVE_SCOPE);
        return {
          ...token,
          accessToken: account.access_token,
          expiresAt: account.expires_at,
          refreshToken: account.refresh_token,
          error: granted ? undefined : ("DriveScopeMissing" as const),
        };
      }
      // The browser asks for a forced refresh when Drive rejects a token early.
      const force =
        trigger === "update" &&
        (session as { refresh?: boolean } | undefined)?.refresh;
      if (
        !force &&
        token.expiresAt &&
        Date.now() < token.expiresAt * 1000 - 60_000
      )
        return token;
      if (!token.refreshToken)
        return { ...token, error: "RefreshTokenError" as const };

      try {
        const res = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          body: new URLSearchParams({
            client_id: process.env.AUTH_GOOGLE_ID!,
            client_secret: process.env.AUTH_GOOGLE_SECRET!,
            grant_type: "refresh_token",
            refresh_token: token.refreshToken,
          }),
        });
        const fresh = (await res.json()) as {
          access_token?: string;
          expires_in?: number;
          refresh_token?: string;
        };
        if (!res.ok || !fresh.access_token)
          throw new Error(`refresh failed (${res.status})`);
        return {
          ...token,
          accessToken: fresh.access_token,
          expiresAt: Math.floor(Date.now() / 1000) + (fresh.expires_in ?? 3600),
          // Google usually keeps the same refresh token; use a new one if sent.
          refreshToken: fresh.refresh_token ?? token.refreshToken,
          error: token.error === "DriveScopeMissing" ? token.error : undefined,
        };
      } catch (err) {
        console.error("Google token refresh failed", err);
        return { ...token, error: "RefreshTokenError" as const };
      }
    },
    async session({ session, token }) {
      // Never the refresh token: only what the browser needs to call Drive.
      session.accessToken = token.accessToken;
      session.expiresAt = token.expiresAt;
      session.error = token.error;
      return session;
    },
  },
});
