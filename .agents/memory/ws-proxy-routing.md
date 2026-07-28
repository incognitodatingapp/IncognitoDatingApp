---
name: WebSocket proxy routing
description: WS paths must be listed in artifact.toml paths array for the shared proxy to forward WebSocket upgrades.
---

## Rule
When an artifact's Express server handles WebSocket connections, the WS path (e.g. `/ws`) must be listed in that artifact's `artifact.toml` `paths` array alongside the REST API path.

**Why:** The shared reverse proxy only forwards traffic to a service for paths explicitly listed in its `artifact.toml`. WebSocket upgrade requests to unlisted paths are silently dropped and the server never sees the connection.

**How to apply:** 
```toml
[[services]]
paths = ["/api", "/ws"]  # Both REST and WS paths listed
```

Use `verifyAndReplaceArtifactToml` to update the toml; never edit artifact.toml directly.
