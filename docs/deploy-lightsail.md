# Deploy to AWS Lightsail (Docker Compose)

Use a single **Ubuntu** Lightsail instance, install **Docker**, clone this repo once, add a **`.env`** on the server, then deploy with **git pull + docker compose**—manually or via **GitHub Actions** over SSH.

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
bash scripts/lightsail-install-docker.sh
```

Log out and back in (or `newgrp docker`) so your user is in the `docker` group.

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

On the server:

```bash
cd ~/pos/POS-1-march-
# If your clone directory name differs, cd into that folder instead.
cp .env.deploy.example .env
nano .env   # set CORS_ORIGIN, JWT_SECRET, POSTGRES_PASSWORD, etc.
```

- **`CORS_ORIGIN`** must match how users open the UI in the browser, e.g. `http://YOUR_STATIC_IP:8080` (no trailing slash).
- Use a strong **`JWT_SECRET`** and **`POSTGRES_PASSWORD`**.

## 5. First deploy (on the server)

```bash
cd ~/pos/POS-1-march-
chmod +x scripts/deploy-on-server.sh
./scripts/deploy-on-server.sh
```

Open **http://YOUR_STATIC_IP:8080** (or your chosen `CLIENT_HOST_PORT`).

## 6. GitHub Actions pipeline (push to deploy)

The workflow **`.github/workflows/deploy-lightsail.yml`** SSHs into the instance, `git pull`, and runs `docker compose up --build -d`.

### Repository secrets (GitHub → Settings → Secrets → Actions)

| Secret | Required | Description |
|--------|----------|-------------|
| `LIGHTSAIL_HOST` | Yes | Static IP or DNS |
| `LIGHTSAIL_USER` | Yes | e.g. `ubuntu` |
| `LIGHTSAIL_SSH_KEY` | Yes | Full private key PEM (contents of `.pem` file) |
| `LIGHTSAIL_APP_PATH` | No | Absolute path to the clone on the server (default in workflow: `$HOME/pos/POS-1-march-`) |

The workflow runs **`git pull`** on the server for **`main`** or **`master`** (whichever exists on `origin`).

**Private repo:** the server must be able to `git pull` without typing a password. Prefer **SSH + deploy key** (**section 3a, option A**) and `git config core.sshCommand` on the clone so CI `git pull` works. Alternatively, configure **HTTPS + credential helper** with a **PAT** on the server (**section 3a, option B**).

### Trigger

- Push to **`main`** or **`master`**, or  
- **Actions** → **Deploy to Lightsail** → **Run workflow**.

## 7. HTTPS (optional)

Point a domain to the static IP, then either:

- Put **Nginx + Certbot** on the host in front of Docker (ports 80/443 → container 8080), or  
- Use **Lightsail load balancer + certificate** (extra monthly cost).

## 8. Troubleshooting

- **`git clone` / authentication failed with 2FA**: GitHub does not accept your account password for Git over HTTPS. Use **SSH + deploy key** or **HTTPS + PAT**—see **section 3a**.
- **`git pull` fails in Actions**: fix deploy key / `core.sshCommand` / PAT on the server; check `LIGHTSAIL_APP_PATH`.
- **CORS errors in browser**: set `CORS_ORIGIN` in server `.env` to the exact origin (scheme + host + port).
- **Out of memory during build**: use a larger Lightsail plan or build images elsewhere and pull (advanced).
