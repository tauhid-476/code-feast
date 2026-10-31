/**
 * Neon project configuration.
 *
 * - `auth: true`: Managed Better Auth on Neon.
 * - `buckets.figures`: private, branch-scoped object store for Problem Figures (ADR 0005).
 */
const config = {
  auth: true,
  buckets: {
    figures: {},
  },
};

export default config;
