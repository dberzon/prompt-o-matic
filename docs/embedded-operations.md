# Embedded runtime operations

## Diagnostics bundle

Include:

- app version and platform triple
- selected AI engine and local-only setting
- sidecar status payload
- last 200 sidecar log lines
- model registry and installed model ids

## Telemetry policy

- default: disabled
- opt-in only
- event scope:
  - sidecar start failure
  - first-run download failure
  - checksum verification failure

Do not include prompt content in telemetry.

## Security controls

- sidecar bound to `127.0.0.1` only
- request header `x-qpb-sidecar-secret` required
- model downloads over HTTPS
- SHA-256 verification on downloaded models
- signed desktop update artifacts
