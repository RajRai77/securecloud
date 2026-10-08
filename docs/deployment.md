# Deploying SecureCloud on a Physical Laptop

The core concept of SecureCloud is to take an unused laptop or PC with adequate storage, install Linux, and run the SecureCloud software stack on it to act as a Private Cloud Server.

This document guides you through preparing the laptop, installing the software, and ensuring it runs persistently as a headless server.

## 1. Laptop Preparation

1.  **Operating System:** Install a stable Linux distribution. We recommend **Ubuntu Server 24.04 LTS** or **Debian 12**, as they are lightweight and have excellent Docker support. If you want a GUI for initial setup, **Linux Mint** is acceptable, but disable sleep/suspend settings.
2.  **Network Setup:** 
    *   Connect the laptop to your router via **Ethernet** for the best stability and speed. Wi-Fi is possible but less reliable.
    *   Assign a **Static IP address** to the laptop from your router's admin panel (e.g., `192.168.1.50`). This ensures the web UI and WhatsApp bot always know where to find the server.
3.  **Power Management (CRITICAL):**
    *   Configure the laptop to **not go to sleep** when the lid is closed.
    *   In `/etc/systemd/logind.conf`, set `HandleLidSwitch=ignore`.
    *   Run `sudo systemctl restart systemd-logind`.
    *   Leave the laptop plugged into AC power permanently.

## 2. Software Installation

1.  **Install Docker and Git:**
    ```bash
    sudo apt update
    sudo apt install -y docker.io docker-compose-v2 git curl
    sudo systemctl enable --now docker
    ```
2.  **Clone the Repository:**
    ```bash
    git clone https://github.com/your-username/securecloud.git
    cd securecloud
    ```
3.  **Configure Environment:**
    ```bash
    cp .env.example .env
    nano .env
    ```
    *   *Crucial:* Set `SECURECLOUD_WEB_TOKEN` to a secure password. You will use this to log into the web dashboard.
    *   Set database passwords and WhatsApp API credentials (optional).

## 3. Launching the Cloud

1.  Run the setup script:
    ```bash
    ./scripts/setup.sh
    ```
2.  This script will build the SecureCloud bot, pull Nextcloud/MariaDB/Redis images, and start everything via `docker compose`.
3.  Because `docker-compose.yml` has `restart: unless-stopped` on all services, the cloud will **automatically start up whenever the laptop is turned on or rebooted**.

## 4. Web UI Access

The SecureCloud web frontend is a Single Page Application (SPA).

1.  On your daily driver PC, copy the `web/` folder from this repository.
2.  Copy `web/.env.example` to `web/.env.local`.
3.  Set `VITE_API_BASE_URL` to point to the static IP of your laptop (e.g., `http://192.168.1.50:3000`).
4.  Run `npm install` and `npm run build` or `npm run dev` to access your private cloud.

Alternatively, you can build the web frontend and host the static files directly from the laptop using an Nginx or Caddy container.

## 5. Maintenance and Status

*   Check system health: `./scripts/health-check.sh`
*   Check service logs and disk usage: `./scripts/status.sh`
*   Backup your data (database and files): `./scripts/backup.sh`
