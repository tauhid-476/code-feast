import { auth } from "@/lib/auth/server";

/**
 * Optimistic gate only: it keeps anonymous visitors out of protected pages.
 * Every page, Server Action, and route handler still checks the session and the
 * role itself — a proxy redirect is not authorization.
 */
export default auth.middleware({ loginUrl: "/sign-in" });

export const config = {
  matcher: ["/admin/:path*", "/join", "/e/:path*"],
};
