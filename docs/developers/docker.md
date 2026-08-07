# Developer Guide — Docker Deploy

**Owner:** CTO · **Status:** Draft  
**Purpose:** Build, run, and ship ForgeOS via Docker on a VPS or local host.

---

## Prerequisites

- Docker Engine 24+ (or Docker Desktop)
- `docker compose` plugin
- 2 GB+ free disk (brain vault + Ollama models)
- Linux host recommended (macOS works; Windows requires WSL2)

## Build

```bash
cd C:\Projects\ForgeOS
docker compose -f infrastructure/docker/docker-compose.yml build
```

## Run (full stack)

```bash
docker compose -f infrastructure/docker/docker-compose.yml up -d
```

This starts:
- `forgeos-brain` on `localhost:7777`
- `forgeos-ollama` on `localhost:11434` (optional; omit if using a remote Ollama)

## Verify

```bash
curl -s http://localhost:8080/healthz
curl -s http://localhost:7777/api/health
```

## Volumes

| Volume | Purpose |
|--------|---------|
| `brain-data` | PGLite vault at `/opt/forgeos/brain` |
| `gbrain-cli` | gbrain CLI install at `/opt/forgeos/gbrain-cli` |
| `ollama-data` | Ollama model cache |

## Environment

| Variable | Default | Required |
|----------|---------|----------|
| `GBRAIN_HOME` | `/opt/forgeos/brain` | yes |
| `GBRAIN_CWD` | `/opt/forgeos/gbrain-cli` | yes |
| `OLLAMA_BASE_URL` | `http://host.docker.internal:11434/v1` | yes |
| `GBRAIN_EMBEDDING_DIMENSIONS` | `1024` | yes |
| `CONSOLE_TOKEN` | — | no (recommended for VPS) |
| `PORT` | `7777` | no |

## GPU (optional)

For Ollama with GPU acceleration, add to `docker-compose.yml`:

```yaml
services:
  ollama:
    deploy:
      reservations:
        devices:
          - driver: nvidia
            count: all
            capabilities: [gpu]
```

Requires `nvidia-container-toolkit` on the host.

## VPS-First Checklist

- [ ] Expose only `7777` (brain) and `11434` (ollama) through firewall
- [ ] Run `docker compose` under `tmux` or systemd unit
- [ ] Mount `gbrain-cli` volume from host (do NOT bake secrets into image)
- [ ] Set `CONSOLE_TOKEN` via env or Docker secret
- [ ] Configure `OLLAMA_BASE_URL` to remote Ollama if not co-located
