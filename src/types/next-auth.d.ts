import type { AuthErrorCode } from "@/auth";

declare module "next-auth" {
  interface Session {
    /** Short-lived Google access token (drive.file), for calling Drive from the browser. */
    accessToken?: string;
    /** Seconds since the epoch. */
    expiresAt?: number;
    error?: AuthErrorCode;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    accessToken?: string;
    expiresAt?: number;
    refreshToken?: string;
    error?: AuthErrorCode;
  }
}
