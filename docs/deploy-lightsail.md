# Deploy to AWS Lightsail (Docker Compose)

Use a single **Ubuntu** Lightsail instance, install **Docker**, clone this repo once, add a **`.env`** on the server, then deploy in one of two ways:

- **Build on the server** with `docker-compose.yml` (simple, but uses more RAM/CPU on Lightsail), or
- **Recommended for small Lightsail instances:** build images in GitHub, push them to **GHCR** (GitHub Container Registry), then have Lightsail only **pull and run** them with `docker-compose.prod.yml`.

This document now focuses on the **GHCR + pull on Lightsail** path because it avoids local builds on the instance.

## 1. Create the Lightsail instance

1. AWS Console → **Lightsail** → **Create instance**.
2. **OS**: Ubuntu (22.04 or 24.04).
3. **Plan**: smallest that fits Docker (e.g. **1 GB RAM** or more for smooth builds).
4. Add a **static IP** and attach it to the instance (optional but recommended).
5. Download the **SSH key** pair Lightsail offers (or use your own key in the console).

## 2. Firewall (Networking)

In Lightsail → instance → **Networking**, open:

| Port | Purpose |
|------|---------|
| **22** | SSH |
| **8080** | Web app (Nginx in compose; map to **80** in production if you use `CLIENT_HOST_PORT=80`) |

Do **not** expose **5432** to the world unless you need remote DB access; use DBeaver over **SSH tunnel** instead.

## 2a. Install Docker (Lightsail Ubuntu has no Docker by default)

A new **Ubuntu** instance does **not** include Docker. Check:

```bash
docker --version
docker compose version
```

If you see **command not found**, install Docker using **one** of these:

### Option A — Official install script (fastest, no repo needed yet)

SSH in as a user with `sudo` (e.g. `ubuntu`), then:

```bash
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
```

Log **out** and SSH back in, **or** run `newgrp docker`, then verify:

```bash
docker --version
docker compose version
```

`get.docker.com` installs the **Docker Compose plugin** (`docker compose`) on current Ubuntu.

### Option B — After you clone this repository

From the repo root:

```bash
bash scripts/lightsail-install-docker.sh
```

Then log out/in or `newgrp docker` (the script adds you to the `docker` group).

### If install fails

- Use **Ubuntu 22.04 or 24.04** on Lightsail (not a minimal custom image without `apt`).
- Ensure you are **not** running the script as root only — use `ubuntu` with `sudo`.
- See [Docker Engine on Ubuntu](https://docs.docker.com/engine/install/ubuntu/) for manual steps.

---

## 3. One-time server setup

SSH in:

```bash
ssh -i /path/to/your-key.pem ubuntu@YOUR_STATIC_IP
```

**Git** is usually preinstalled on Ubuntu. If not: `sudo apt-get update && sudo apt-get install -y git`.

Clone this repository **once** using **either SSH or HTTPS with a token** (see next section if you use **two-factor authentication (2FA)** on GitHub—password-only HTTPS will **not** work).

```bash
# Example — replace with your real clone URL and path:
mkdir -p ~/pos
cd ~/pos
# git clone <YOUR_CLONE_URL> POS-1-march-
cd POS-1-march-
```

If you **already installed Docker** (section **2a, option A**), skip the next line. Otherwise:

```bash
bash scripts/lightsail-install-docker.sh
```

If you just ran the install script, log out and back in (or `newgrp docker`) so your user is in the `docker` group.

## 3a. GitHub 2FA: why `git clone` fails and how to fix it

If **2FA is enabled** on your GitHub account, GitHub **does not allow** using your **account password** for `git clone` / `git pull` over **HTTPS**. A password prompt will always fail (or ask for auth and reject the password).

Use **one** of these approaches:

### Option A — SSH clone + deploy key (recommended for Lightsail)

1. On the Lightsail instance:

   ```bash
   ssh-keygen -t ed25519 -C "lightsail-deploy" -f ~/.ssh/github_pos -N ""
   cat ~/.ssh/github_pos.pub
   ```

2. In GitHub: open the repo → **Settings** → **Deploy keys** → **Add deploy key**.  
   Paste the **public** key (`.pub`). Enable **Allow write access** only if you need the server to push (usually **read-only** is enough for deploy).

3. Clone with **SSH** (replace `OWNER` and `REPO`):

   ```bash
   mkdir -p ~/pos && cd ~/pos
   GIT_SSH_COMMAND='ssh -i ~/.ssh/github_pos -o IdentitiesOnly=yes' \
     git clone git@github.com:OWNER/REPO.git POS-1-march-
   ```

4. Make that SSH key the default for this repo (so `git pull` in Actions/scripts works):

   ```bash
   cd ~/pos/POS-1-march-
   git config core.sshCommand "ssh -i ~/.ssh/github_pos -o IdentitiesOnly=yes"
   ```

For **private repos**, the deploy key must be added **on that repository**. For **multiple repos**, use a **machine user** account with an SSH key under **GitHub → Settings → SSH and GPG keys** instead.

### Option B — HTTPS clone + Personal Access Token (PAT)

1. GitHub → **Settings** → **Developer settings** → **Personal access tokens**.  
   Create a **Fine-grained** token (or **classic** with `repo` scope for private repos).

2. Clone (Git will prompt for credentials):

   ```bash
   git clone https://github.com/OWNER/REPO.git ~/pos/POS-1-march-
   ```

   - **Username:** your GitHub username (or `x` with fine-grained tokens—GitHub will accept token as password when prompted, depending on client).
   - **Password:** paste the **token** (not your GitHub password).

3. Optional: avoid future prompts by storing the URL with an embedded token (less safe on shared servers) or use **Git Credential Manager** / `git config credential.helper store` (understand the security tradeoff).

**Summary:** With 2FA, use **SSH + deploy key** or **HTTPS + PAT**—never your normal login password.

## 4. Production environment file

On the server, you must be in the **repository root** (the folder that contains `docker-compose.yml`).

```bash
cd ~/pos/POS-1-march-    # or whatever you named the clone
pwd
ls -la docker-compose.yml deploy.env.example .env.deploy.example 2>/dev/null || true
```

Create `.env` using **either** command (same template):

```bash
# Easiest on Linux: filename has no leading dot (shows up in plain `ls`)
cp deploy.env.example .env

# Or, if this file exists on your clone:
cp .env.deploy.example .env
```

Then edit:

```bash
nano .env   # set CORS_ORIGIN, JWT_SECRET, POSTGRES_PASSWORD, etc.
```

### If you get “No such file” / “not there”

1. **Wrong directory** — `docker-compose.yml` must exist here: `ls docker-compose.yml`. If not, `cd` into your actual clone path.
2. **Old clone / branch** — The template files might not exist if you never **pulled** the latest commit from GitHub. Run `git pull` on the server, or push these files from your PC and pull again.
3. **Hidden file** — `.env.deploy.example` starts with `.` so `ls` hides it. Use `ls -la` or use **`deploy.env.example`** instead (`cp deploy.env.example .env`).
4. **Download without Git** — Replace `OWNER`, `REPO`, and `BRANCH` (e.g. `main`):

   ```bash
   curl -fsSL "https://raw.githubusercontent.com/OWNER/REPO/BRANCH/deploy.env.example" -o .env
   nano .env
   ```

- **`CORS_ORIGIN`** must match how users open the UI in the browser, e.g. `http://YOUR_STATIC_IP:8080` (no trailing slash).
- Use a strong **`JWT_SECRET`** and **`POSTGRES_PASSWORD`**.
- Set **`SERVER_IMAGE`** and **`CLIENT_IMAGE`** to your GHCR image names, for example:

```env
SERVER_IMAGE=ghcr.io/YOUR_GITHUB_USERNAME/pos-1-march-server:latest
CLIENT_IMAGE=ghcr.io/YOUR_GITHUB_USERNAME/pos-1-march-client:latest
```

## 5. How GHCR works in this project

**GHCR** is **GitHub Container Registry**. It stores Docker images the same way GitHub stores git repositories.

In this repo:

1. **GitHub Actions** workflow **`.github/workflows/publish-ghcr.yml`** builds:
   - `server/Dockerfile`
   - `client/Dockerfile`
2. It pushes those images to:
   - `ghcr.io/<your-github-user-or-org>/pos-1-march-server:latest`
   - `ghcr.io/<your-github-user-or-org>/pos-1-march-client:latest`
3. On Lightsail, **`docker-compose.prod.yml`** uses those image names from `.env`.
4. The server runs:

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

So Lightsail **does not build** your app. It only downloads ready-made images and starts containers.

## 6. Publish images to GHCR

Push to **`main`** or **`master`**, or run the workflow manually:

- **Actions** → **Publish Docker Images to GHCR** → **Run workflow**

By default the workflow uses **`GITHUB_TOKEN`** and publishes to:

```text
ghcr.io/<repo-owner>/pos-1-march-server:latest
ghcr.io/<repo-owner>/pos-1-march-client:latest
```

### GHCR package visibility

- If the package is **public**, Lightsail can pull it without logging in.
- If the package is **private**, Lightsail must run `docker login ghcr.io` first.

For private packages, create a GitHub token with **`read:packages`** and store it in Actions secrets used by deploy:

- `GHCR_USERNAME`
- `GHCR_TOKEN`

## 7. First deploy on Lightsail (pull prebuilt images)

```bash
cd ~/pos/POS-1-march-
chmod +x scripts/deploy-on-server.sh
./scripts/deploy-on-server.sh
```

Open **http://YOUR_STATIC_IP:8080** (or your chosen `CLIENT_HOST_PORT`).

This script now uses:

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

## 8. GitHub Actions pipeline (push to deploy)

The workflow **`.github/workflows/deploy-lightsail.yml`** SSHs into the instance, `git pull`, then runs:

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

### Repository secrets (GitHub → Settings → Secrets → Actions)

| Secret | Required | Description |
|--------|----------|-------------|
| `LIGHTSAIL_HOST` | Yes | Static IP or DNS |
| `LIGHTSAIL_USER` | Yes | e.g. `ubuntu` |
| `LIGHTSAIL_SSH_KEY` | Yes | Full private key PEM (contents of `.pem` file) |
| `LIGHTSAIL_APP_PATH` | No | Absolute path to the clone on the server (default in workflow: `$HOME/pos/POS-1-march-`) |
| `GHCR_USERNAME` | If GHCR package is private | GitHub username/org used to pull package |
| `GHCR_TOKEN` | If GHCR package is private | Token with `read:packages` scope |

The workflow runs **`git pull`** on the server for **`main`** or **`master`** (whichever exists on `origin`).

**Private repo:** the server must be able to `git pull` without typing a password. Prefer **SSH + deploy key** (**section 3a, option A**) and `git config core.sshCommand` on the clone so CI `git pull` works. Alternatively, configure **HTTPS + credential helper** with a **PAT** on the server (**section 3a, option B**).

**Private GHCR images:** the workflow logs in to GHCR on Lightsail only if both `GHCR_USERNAME` and `GHCR_TOKEN` are set.

### Trigger

- Push to **`main`** or **`master`**, or  
- **Actions** → **Deploy to Lightsail** → **Run workflow**.

## 9. HTTPS (optional)

Point a domain to the static IP, then either:

- Put **Nginx + Certbot** on the host in front of Docker (ports 80/443 → container 8080), or  
- Use **Lightsail load balancer + certificate** (extra monthly cost).

## 10. Troubleshooting

- **`git clone` / authentication failed with 2FA**: GitHub does not accept your account password for Git over HTTPS. Use **SSH + deploy key** or **HTTPS + PAT**—see **section 3a**.
- **`git pull` fails in Actions**: fix deploy key / `core.sshCommand` / PAT on the server; check `LIGHTSAIL_APP_PATH`.
- **Lightsail cannot build images / out of memory**: use the GHCR path in this document so the instance only pulls images.
- **`docker pull` from GHCR fails**: check package visibility, image names in `.env`, and `GHCR_USERNAME` / `GHCR_TOKEN` if the package is private.
- **CORS errors in browser**: set `CORS_ORIGIN` in server `.env` to the exact origin (scheme + host + port).
