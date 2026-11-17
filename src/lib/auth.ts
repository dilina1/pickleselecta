import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import type { JWT } from "next-auth/jwt";

// Google sign-in is only needed to save a set as a YouTube Music playlist.
// Tokens stay in the encrypted session cookie and are never sent to the browser.
export const authOpts: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/youtube",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
      }
      return token;
    },
  },
};

// Returns a valid access token for server-side YouTube calls, refreshing it if needed.
export async function freshAccessToken(token: JWT | null): Promise<string | null> {
  if (!token) return null;
  const expiresAt = token.expiresAt as number | undefined;
  if (token.accessToken && expiresAt && Date.now() / 1000 < expiresAt - 60) {
    return token.accessToken as string;
  }
  if (!token.refreshToken) return null;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      grant_type: "refresh_token",
      refresh_token: token.refreshToken as string,
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.access_token ?? null;
}
