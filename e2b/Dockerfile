# Code Feast sandbox template.
#
# Why this exists: E2B's default template (`e2bdev/base`) ships python3 3.11.6
# and g++ but no JDK, so `javac` is missing and Java cannot compile at all. The
# runner needs all three languages in one image (src/lib/runner/run.ts), so this
# template adds a headless JDK on top of the stock base.
#
# It starts from `e2bdev/base` on purpose. That image carries the envd
# entrypoint, the `user` account (uid 1000) and the writable directories the
# SDK and sandbox start-up expect; hand-rolling the runtime breaks both. The
# build therefore only installs packages and never touches the entrypoint, the
# user, or the working directory.
#
# Build it with `npm run e2b:build` (scripts/build-e2b-template.ts), then set
# the printed id as E2B_TEMPLATE_ID.

FROM e2bdev/base:latest

# openjdk-17 is what Debian 12 (bookworm) ships. Headless: the runner only ever
# needs `javac` and `java`, never a display or the desktop packages.
RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        openjdk-17-jdk-headless \
    && rm -rf /var/lib/apt/lists/*

# Fail the build, not the contest, if the base image ever stops carrying the
# toolchain the runner assumes. Python and C++ come from the base image; Java
# comes from the step above.
RUN python3 --version && g++ --version && javac -version && java -version
