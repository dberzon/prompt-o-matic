# Embedded runtime QA matrix

## OS coverage

- Windows 10/11 x64
- macOS 13+ arm64 and x64
- Ubuntu 22.04 x64

## Scenarios

- First launch with no model installed
- First launch offline
- Model download interrupted and resumed
- Checksum mismatch and retry
- Sidecar startup timeout
- Sidecar unexpected exit during request
- Engine switch: embedded <-> local ollama <-> cloud
- Local-only enabled with no local runtime
- Low RAM warning path
- Low disk-space blocking path

## Acceptance checklist

- Embedded model can be downloaded and verified.
- Sidecar starts and responds on localhost.
- Prompt polish succeeds with `AI: Embedded`.
- Health endpoint includes `embedded.ready` and `embedded.modelId`.
- Switching away from embedded does not break cloud/local behavior.
