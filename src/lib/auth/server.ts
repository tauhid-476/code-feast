import "server-only";

import { createNeonAuth } from "@neondatabase/auth/next/server";
import { neonAuthBaseUrl, neonAuthCookieSecret } from "@/lib/env";

/**
 * Server-side auth singleton. Sessions live in Neon Auth's `neon_auth` schema;
 * this app only ever reads the session, never the password.
 */
export const auth = createNeonAuth({
  baseUrl: neonAuthBaseUrl(),
  cookies: { secret: neonAuthCookieSecret() },
});
