# QUEUE! — Healthcare Queue & Triage Demo (SaaS)

A comprehensive Queue Management System (QMS) designed for healthcare facilities. Features a multi-role ecosystem (Kiosk, Operator, TV Display, Admin) with real-time WebSocket updates, mock/api toggle modes, and robust analytics.

## Demo Highlights
- **Kiosk Flow**: Touch-friendly ticket issuance with DNI recognition and service selection.
- **Operator Console**: Real-time queue management, priority triaging, and "Call/Start/Finish" workflow.
- **TV Display**: Dynamic waiting room screen with "Now Serving" overlays and voice callouts.
- **Real Analytics**: Live dashboard powered by PostgreSQL and Server-Sent Events (SSE).
- **Hybrid Architecture**: Runs fully mocked (standalone) or integrated with .NET API.

## Tech Stack
- **Frontend**: Vite + TypeScript (Multi-Page App) + TailwindCSS
- **Backend**: ASP.NET Core 8 Minimal API + Entity Framework Core
- **Database**: PostgreSQL (Dockerized)
- **Infrastructure**: Docker Compose, Nginx Reverse Proxy
- **Quality Assurance**: Playwright (E2E), xUnit (Integration), GitHub Actions CI

## Project Structure
```
├── apps/
│   ├── web/        # Frontend (Vite/TS/Tailwind)
│   └── api/        # Backend (.NET 8 API)
├── scripts/        # Automation & Smoke Tests
├── nginx/          # Reverse Proxy Config
└── @fotos/         # Automated Demo Captures
```

## Run Locally (Dev)

**Prerequisites**: Node.js 18+, .NET 8 SDK, Docker Desktop.

1. **Start Database & Services**
   ```bash
   docker compose up -d
   ```

2. **Run Backend API**
   ```bash
   cd apps/api
   dotnet run
   ```
   *API runs on http://localhost:5150*

3. **Run Frontend**
   ```bash
   cd apps/web
   npm run dev
   ```
   *Web runs on http://localhost:5173*

## Production / VPS Deploy
The project is production-ready with `docker-compose.prod.yml`.
- **Nginx**: Handles routing (`/` -> Web, `/api` -> Backend).
- **CORS**: Configured for secure cross-origin access.
- **Health**: Built-in health checks for container orchestration.

## Authentication (Demo)
Auth is currently **OPTIONAL** (`QUEUE_AUTH_REQUIRED=false`).
To enable: set env var to `true`.
- **Admin**: `admin` / `admin123`
- **Operator**: `operador` / `op123`

## Testing & Automation
- **Backend Integration**: `cd apps/api && dotnet test`
- **Capture Demo Media**:
  ```bash
  cd apps/web
  npm run capture:demo
  ```
  Generates screenshots in `@fotos/` for documentation.

---
*For portfolio demonstration purposes only. 2026.*
