# Embedded runtime spike (phase 2)

This document outlines the next implementation phase after Ollama support is stable.

## Objective

Ship an end-user desktop local inference mode that works without requiring a separate Ollama install.

## Proposed shape

- Package a local inference sidecar binary with the desktop app.
- Keep the same backend provider contract already used by cloud/Ollama.
- Add `embedded` as a provider value in resolver logic once runtime is available.

## Model lifecycle

1. First run prompts the user to download a model pack.
2. App verifies checksum + model version before activation.
3. Model files are stored in user-writable app data folder.
4. Runtime reports readiness through health endpoint.

## Reliability controls

- Watchdog restart if sidecar exits unexpectedly.
- Startup timeout and graceful cloud fallback in `auto`.
- Disk, memory, and CPU capability preflight checks.

## UX additions

- Setup wizard with:
  - model size estimate
  - storage path selection
  - progress + pause/cancel
- Diagnostics panel:
  - runtime status
  - model version
  - recent local errors

## Exit criteria for spike

- Embedded sidecar can generate one polish response via provider interface.
- Health check reports `local.available=true` when sidecar is ready.
- Auto mode falls back cleanly if embedded runtime fails.
