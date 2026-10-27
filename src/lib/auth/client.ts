"use client";

import { createAuthClient } from "@neondatabase/auth/next";

/**
 * Browser client. It talks to the same-origin `/api/auth` proxy, so no auth
 * base URL is shipped to the browser.
 */
export const authClient = createAuthClient();
