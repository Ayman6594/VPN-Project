# 🔒 Self-Hosted VPN Server

A full SSL VPN server inspired by FortiClient / Ivanti Connect Secure —
built with **ocserv**, **Node.js**, **Nginx**, and **Docker Compose**.

Includes a web admin panel to manage users and monitor connections.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  Docker Host                    │
│                                                 │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │  ocserv  │    │  web-ui  │    │  nginx   │  │
│  │ SSL VPN  │    │ Node.js  │◄───│  :80     │  │
│  │ :443/tcp │    │ :3000    │    │  :8443   │  │
│  │ :443/udp │    └────┬─────┘    └──────────┘  │
│  └────┬─────┘         │                         │
│       │         shared volume                   │
│       └─────────(/etc/ocserv)───────────────────┘
│                 ocpasswd + certs
└─────────────────────────────────────────────────┘
```

**How it works:**
- `ocserv` runs the actual VPN tunnel over SSL/TLS (port 443)
- `web-ui` is a Node.js admin panel to create/delete VPN users
- `nginx` proxies HTTP→HTTPS and serves the admin panel on port 8443
- A **shared Docker volume** lets the web UI write to `ocpasswd` (the VPN user database)

---

## Prerequisites

Install these on your Windows machine:

1. **Docker Desktop** → https://www.docker.com/products/docker-desktop/
2. **WSL 2** (required by Docker Desktop on Windows) — Docker will prompt you
3. **Git** → https://git-scm.com/ (optional, to clone)

---

## Step 1 — Get the project

```bash
# Option A: clone from GitHub (after you push it)
git clone https://github.com/YOUR_USERNAME/vpn-project.git
cd vpn-project

# Option B: just unzip the folder and open a terminal inside it
```

---

## Step 2 — Configure credentials

Open `.env` and change the default admin password:

```env
ADMIN_USER=admin
ADMIN_PASS=your-strong-password-here
SESSION_SECRET=any-long-random-string
```

---

## Step 3 — Build and start

```bash
docker compose up --build
```

First run takes ~2 minutes (downloads base images, builds containers).
You'll see logs from all three services.

To run in the background:

```bash
docker compose up --build -d
```

---

## Step 4 — Open the Admin Panel

Go to: **http://localhost:80** or **http://localhost:8443**

Log in with the credentials from your `.env` file.

You'll see:
- **Dashboard** — server status, active connections, user count
- **VPN Users** — add / delete VPN user accounts
- **Connections** — live connected clients
- **About** — project tech stack

---

## Step 5 — Add a VPN User

1. Click **VPN Users** in the sidebar
2. Click **Add User**
3. Enter a username and password
4. Click **Create User**

The user is now stored in `ocpasswd` inside the shared volume.

---

## Step 6 — Connect a VPN Client

You can connect using any **OpenConnect-compatible client**:

### Option A: OpenConnect CLI (Linux/Mac/WSL)
```bash
sudo openconnect --protocol=anyconnect https://localhost
# Enter the VPN username and password you created
```

### Option B: Cisco AnyConnect
- Server: `your-machine-ip`
- Accept the self-signed certificate warning

### Option C: OpenConnect GUI
- Download from https://openconnect.github.io/openconnect-gui/

---

## Project Structure

```
vpn-project/
├── docker-compose.yml       # Orchestrates all services
├── .env                     # Admin credentials (don't commit this!)
├── .gitignore
│
├── ocserv/
│   ├── Dockerfile           # Alpine Linux + ocserv
│   ├── ocserv.conf          # VPN server configuration
│   └── entrypoint.sh        # Cert generation + iptables + startup
│
├── nginx/
│   └── nginx.conf           # Reverse proxy config
│
└── web-ui/
    ├── Dockerfile            # Node.js + Alpine
    ├── package.json
    ├── server.js             # Express API (auth, user CRUD, status)
    └── public/
        └── index.html        # Single-page admin UI
```

---

## Useful Commands

```bash
# View logs
docker compose logs -f

# View logs for one service
docker compose logs -f ocserv
docker compose logs -f web-ui

# Stop everything
docker compose down

# Stop and delete all data (users, certs)
docker compose down -v

# Restart a single service
docker compose restart web-ui

# Shell into the VPN container
docker exec -it vpn-server sh

# Manually add a VPN user from CLI
docker exec -it vpn-server sh -c 'echo -e "password\npassword" | ocpasswd -c /etc/ocserv/ocpasswd username'

# List VPN users
docker exec -it vpn-server cat /etc/ocserv/ocpasswd
```

---

## How SSL VPN Works (the learning part)

```
Client                          ocserv (server)
  │                                  │
  │──── TLS Handshake (port 443) ───►│
  │◄─── Server Certificate ──────────│
  │                                  │
  │──── HTTP POST /auth ────────────►│ (username + password)
  │◄─── Session Cookie ──────────────│
  │                                  │
  │──── CONNECT tunnel ─────────────►│
  │◄═══ Encrypted IP tunnel ═════════│
  │         (all traffic)            │
```

1. Client connects over **TLS on port 443** (same port as HTTPS — hard to block)
2. Server authenticates with a **certificate** (self-signed in our case)
3. User authenticates with **username + password**
4. A **virtual network interface** (vpns0) is created on both ends
5. All traffic is **encapsulated and encrypted** through the tunnel
6. Server does **NAT** so VPN clients can reach the internet

This is the same fundamental mechanism used by FortiClient and Ivanti Connect Secure.

---

## Ideas to extend this project

- [ ] Add 2FA (TOTP) using `ocserv` RADIUS integration
- [ ] Replace self-signed cert with Let's Encrypt (certbot)
- [ ] Add connection logging to a database (SQLite or PostgreSQL)
- [ ] Build a traffic dashboard with real-time charts
- [ ] Add user groups with different access policies
- [ ] Deploy to a cloud VM (AWS/GCP/Azure) for a real public VPN

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| VPN Protocol | SSL/TLS — OpenConnect (ocserv) |
| VPN Server OS | Alpine Linux (Docker) |
| Admin Backend | Node.js + Express |
| Admin Frontend | Vanilla JS + CSS |
| Reverse Proxy | Nginx |
| Containerization | Docker Compose |
| Authentication | ocpasswd + express-session |
