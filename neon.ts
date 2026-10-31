/**
 * Neon project configuration. `buckets.figures` is the private, branch-scoped
 * object store for Problem Figures (ADR 0005). Apply it with `neon deploy` on
 * the dev branch and on the production project; `neon env pull` then writes the
 * `AWS_*` credentials the app reads through `figuresStorageConfig()`.
 *
 * The bucket is private on purpose: every read is authorized by
 * `/api/figures/[id]`, so a statement cannot be read by anyone holding a link.
 */
const config = {
  buckets: {
    figures: {},
  },
};

export default config;
