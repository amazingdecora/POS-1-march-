# POS-1-march-

Amazing Decora – Management System (POS). Node/Express API + React frontend; optional Docker setup.

## Run with Docker (recommended)

1. **Start Docker Desktop** so the Docker daemon is running.
2. From the project root:
   ```bash
   docker compose up --build -d
   ```
3. Open:
   - **App:** http://localhost:8080  
   - **API (through nginx):** http://localhost:8080/api/health  
   - **API (direct on host):** http://localhost:4001/api/health — mapped to avoid clashing with local `npm run dev` on port **4000**.

Postgres (user `amazing_user`, password `amazing_pass`, DB `amazing_decora`) runs in the `db` container; the API uses it automatically.

**Admin login (React app):** username `admin`, password `admin123` by default (override with `ADMIN_DEFAULT_PASSWORD` in Compose / `.env`). Set a strong `JWT_SECRET` in production.

### DBeaver / local Postgres port

Compose maps Postgres to **`127.0.0.1:${HOST_PG_PORT:-5432}`** (default **5432**). To print ready-to-use DBeaver settings and ensure `db` is up:

```bash
chmod +x scripts/dbeaver-postgres-forward.sh
./scripts/dbeaver-postgres-forward.sh
```

If **5432** is already in use, set e.g. `HOST_PG_PORT=5433` in a `.env` file next to `docker-compose.yml` (or export it), run `docker compose up -d db`, then run the script again.

Optional: extra local forward on another port (pulls `nicolaka/netshoot` once):

```bash
EXTRA_LOCAL_PORT=15432 ./scripts/dbeaver-postgres-forward.sh
```

Use **Git Bash** or **WSL** on Windows to run the `.sh` file.

### Docker not starting?

- **`bind: ... 4000 ... already permitted`** — Something else is using port 4000 (often the backend from `npm run dev`). This compose file maps the API to host port **4001** instead. Rebuild and start again: `docker compose up --build -d`.
- **Port 8080 in use** — Change the mapping, e.g. `CLIENT_HOST_PORT=3000` is not wired by default; edit `docker-compose.yml` client ports to `"3000:80"` or stop the other app on 8080.
- **Port 5432 in use** — Stop local PostgreSQL or change the `db` service `ports` in `docker-compose.yml` (e.g. `"5433:5432"`) and update `DATABASE_URL` host port if you connect from the host.

## Run locally (without Docker)

- **Backend:** `cd server && npm install && npm run dev` → http://localhost:4000  
  Set `server/.env` from `server/.env.example` and add `DATABASE_URL` for Postgres.
- **Frontend:** `cd client && npm install && npm run dev` → http://localhost:5173 (proxies `/api` to the backend).