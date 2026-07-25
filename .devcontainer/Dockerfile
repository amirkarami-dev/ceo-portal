FROM mcr.microsoft.com/devcontainers/python:3.13-bullseye

# The upstream python:3.13-bullseye dev container image ships a Yarn apt source
# (/etc/apt/sources.list.d/yarn.list) whose signing key has expired. That makes
# every `apt-get update` fail with:
#   NO_PUBKEY 62D54FD4003F6525 / "The repository ... is not signed."
# which in turn breaks dev container feature installs (e.g. docker-in-docker).
# The Yarn apt repo isn't needed inside the container, so drop the stale source
# and verify apt can update cleanly.
RUN set -eux; \
    rm -f /etc/apt/sources.list.d/yarn.list; \
    apt-get update
