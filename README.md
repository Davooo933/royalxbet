# Crypto Casino Monorepo (MVP)

This repository contains an MVP backend and admin frontend for a crypto casino platform with a smart RTP controller targeting 30% RTP to players (70% house edge) across games.

Important: Operating real-money gambling requires strict legal compliance (licensing, KYC/AML, geofencing, RG/SG tools). This code is for educational and testing purposes. Do not deploy without legal review and proper licensing. Avoid using trademarked game names/assets.

## Apps
- Backend: Node.js/TypeScript (Express, Prisma, Postgres, Redis) at `apps/backend`
- Admin: Vite + React at `apps/admin`

## Quick start

1. Copy environment file:
   ```bash
   cp .env.example .env
   ```
2. Start dependencies:
   ```bash
   docker compose up -d
   ```
3. Install deps and generate Prisma client:
   ```bash
   npm install
   npm -w apps/backend run prisma:generate
   ```
4. Run database migrations (creates schema):
   ```bash
   npm -w apps/backend run prisma:migrate
   ```
5. Start dev servers:
   ```bash
   npm run dev
   ```

Backend at `http://localhost:4000`, Admin at `http://localhost:5173`.

## Default admins
Configured via `ADMIN_EMAILS` env var. On server start, admin users are created automatically.

## Crypto (TRC-20 USDT)
A TronWeb integration skeleton is provided for deposit address retrieval and withdrawals as records. You must integrate a secure wallet service, cold/hot wallet segregation, and a deposit listener (via TronGrid or full node) before production use.

## RTP Controller
The backend implements a rolling-window RTP controller per game using recent rounds to bias win gating towards the configured `rtpTargetBp` (default 3000 = 30.00%).

## Games
Included math models: Coinflip, Dice, Crash, Plinko, Roulette, simple Slots. Additional games can be added as new `gameKey`s and math logic in `apps/backend/src/routes/games.ts`.

## Security & Compliance
- Implement full auth flows, 2FA, KYC/AML, self-exclusion, RG tools before launch.
- Log and audit admin actions.
- Respect IP/trademarks: do not use third-party branded game names/assets without rights.