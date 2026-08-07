# Video Tutorial Script — Docker Deploy

**Length:** 4–6 minutes  
**Audience:** VPS operators, developers, ops  
**Style:** Screencast + voice-over

---

## Scene 1 — Intro (0:00–0:30)

| Time | Visual | Audio |
|------|--------|-------|
| 0:00 | ForgeOS logo + tagline: *"Ship anywhere with one container."* | "In this tutorial you will containerize ForgeOS, run it on a VPS, and verify the brain is live." |
| 0:15 | Terminal window with `docker --version`. | "Prerequisites: Docker Engine 24+, docker compose plugin, and about 2 GB of disk." |

## Scene 2 — Clone & Build (0:30–1:15)

| Time | Visual | Audio |
|------|--------|-------|
| 0:30 | `git clone https://github.com/forgeos/forgeos.git` | "Clone the monorepo. The Dockerfile lives under `infrastructure/docker/`." |
| 0:45 | `cd forgeos && docker compose -f infrastructure/docker/docker-compose.yml build` | "Build the multi-stage image. The final stage is minimal Node 20 Alpine — under 200 MB." |

## Scene 3 — First Run (1:15–2:30)

| Time | Visual | Audio |
|------|--------|-------|
| 1:15 | `docker compose -f infrastructure/docker/docker-compose.yml up -d` | "Start the stack in detached mode. `forgeos-brain` binds to port 7777; `forgeos-ollama` to 11434." |
| 1:45 | `docker compose ps` | "Two containers running. Brain Console is reachable on `localhost:7777`." |
| 2:00 | Browser at `http://127.0.0.1:7777` | "Open the console. The first request seeds the brain vault automatically." |

## Scene 4 — Verify & Tail Logs (2:30–3:30)

| Time | Visual | Audio |
|------|--------|-------|
| 2:30 | `curl -s http://localhost:8080/healthz` | "Hit the gateway health endpoint to confirm ingress is up." |
| 2:45 | `curl -s http://localhost:7777/api/health/detailed` | "Detailed health returns gbrain, ollama, and schema pack status." |
| 3:00 | `docker logs -f forgeos-brain` | "Tail logs for debugging. Structured JSON logs are emitted to stdout." |

## Scene 5 — Persist & Restart (3:30–4:30)

| Time | Visual | Audio |
|------|--------|-------|
| 3:30 | `docker compose down && docker compose up -d` | "Stop and restart — data persists in `brain-data` and `gbrain-cli` volumes." |
| 3:45 | `docker volume ls` | "Volumes survive container recreation; remove them only if you want a clean brain." |
| 4:00 | `docker compose pull && docker compose up -d` | "Update by pulling the latest image. The VPS-first workflow keeps this in a tmux session or systemd unit." |

## Outro (4:30–5:00)

| Time | Visual | Audio |
|------|--------|-------|
| 4:30 | ForgeOS repo + `docs/developers/docker.md` | "Next: read the Docker developer guide, then publish your first capability to the marketplace." |
