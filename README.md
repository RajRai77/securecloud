# SecureCloud

**Secure File Sharing and Personal Cloud Storage Using Nextcloud with a Custom Web UI and WhatsApp Bot**

A self-hosted personal cloud storage platform designed to run on a repurposed laptop or PC.
It uses [Nextcloud](https://nextcloud.com/) as the robust storage backend. 
Users access their files through a beautiful, custom **React SPA Web Dashboard**, or via a conversational **WhatsApp bot**. Both interfaces communicate through a custom Node.js/TypeScript backend API, ensuring all files remain safely on your own hardware.

## Architecture

```
                    INTERNET (or Local Network)
                      |
        +-------------+-------------+
        |                           |
  Web Browser (React UI)       WhatsApp User
        |                           |
        |                  WhatsApp Cloud API
        v                           v
  +---------------------------------------+
  |            SecureCloud Bot            |
  | (Node.js/TypeScript REST API + Webhook)|
  +-------------------+-------------------+
                      |
                      | HTTPS / WebDAV / OCS API
                      v
             +-------------------+
             |    Nextcloud      |
             +----+---------+----+
                  |         |
                  v         v
             MariaDB      Redis
                  |
                  v
             File Storage (Docker volume)
```

All services run as Docker containers orchestrated by `docker-compose.yml`, on a single
Linux Mint / Ubuntu machine.

## Quick start

```bash
git clone <repository-url>
cd securecloud
cp .env.example .env
nano .env                  # fill in database passwords, WhatsApp credentials, etc.
./scripts/setup.sh
```

`setup.sh` checks your OS/Docker installation, pulls images, starts every service, and
waits for health checks to pass. See [`docs/installation.md`](docs/installation.md) for the
full walkthrough, including WhatsApp Cloud API setup.

## Project layout

```
securecloud/
├── docker-compose.yml       # Orchestrates mariadb, redis, nextcloud, bot, reverse proxy
├── .env.example             # All configuration/secrets, as placeholders
├── bot/                     # SecureCloud backend API (Node.js/TS) + WhatsApp bot
├── web/                     # SecureCloud frontend (React, Vite, TypeScript)
├── docker/                  # Per-service Docker configuration (php.ini, Caddyfile)
├── scripts/                 # setup / start / stop / status / health / backup
├── docs/                    # Architecture, deployment, security, viva docs
└── tests/integration/       # Manual integration-test checklist
```

## What's custom vs. what's Nextcloud

Nextcloud (used as a headless engine) provides: file storage, upload, download, folders, sharing, password-protected/expiring share links, and base authentication.

The custom code provides:
- `bot/`: The REST API layer, WebDAV/OCS API bridging, session handling, action logging, and the WhatsApp conversational interface.
- `web/`: The custom-designed React dashboard providing a premium UI for file management, system health monitoring, and activity logs.

## Documentation

- [Architecture](docs/architecture.md)
- [Deployment (Physical Laptop)](docs/deployment.md)
- [Installation](docs/installation.md)
- [Security](docs/security.md)
- [WhatsApp Cloud API setup](docs/whatsapp-setup.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Testing](docs/testing.md)
- [Viva questions & answers](docs/viva.md)

## License

See [LICENSE](LICENSE).
