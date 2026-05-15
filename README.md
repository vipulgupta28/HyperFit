# HyperFit — Territory Run

> **Claim the streets. Defend your ground. Outlast everyone.**

HyperFit is a real-time, location-based territory game built for mobile. Walk or run through your city to capture hexagonal tiles on a live map. Every step you take adds strength to the tiles you cross. Stop moving and rivals can take them back.

It's fitness infrastructure with a competitive layer on top — the kind of app that turns a morning run into a battle.

---

## What It Does

- **Capture territory** by physically walking or running over hexagonal map tiles
- **Defend your ground** — tiles accumulate strength as you revisit them, making them harder to conquer
- **Attack rivals** — reduce enemy tile strength until you take over
- **Race to the top** — leaderboard ranks every player by total territory owned
- **Share your runs** — post routes, distances, and paces to a social feed
- **Watch it happen live** — tile ownership updates in real time across all players via WebSocket

---

## Tech Stack

### Mobile (Frontend)

| Layer | Technology |
|---|---|
| Framework | React Native 0.81 + Expo 54 |
| Language | TypeScript 5.9 |
| Routing | Expo Router (file-based) |
| State | Zustand 5 |
| Maps | React Native Maps + iOS HybridFlyover / 3D mode |
| Location | Expo Location (foreground + background GPS) |
| Animations | React Native Reanimated 4 + Animated API |
| Real-time | Socket.io Client 4 |
| HTTP | Axios |
| Auth Storage | Expo SecureStore (encrypted) |
| Fonts | Poppins via Expo Google Fonts |
| Haptics | Expo Haptics |

### Server (Backend)

| Layer | Technology |
|---|---|
| Runtime | Node.js + TypeScript |
| Framework | Express 5 |
| Real-time | Socket.io 4 |
| Database | Supabase (PostgreSQL) |
| Hex Grid | Uber H3 (resolution 11, ~50–70m cells) |
| Auth | JWT (jsonwebtoken) |

---

## Architecture Highlights

**Hexagonal Grid System**
Territory is divided using Uber's H3 library at resolution 11 — approximately 50–70 meter hexagons. This provides consistent, non-overlapping coverage of any geography in the world.

**Effort-Based Capture**
Tiles don't flip instantly. A player must accumulate enough GPS-verified movement effort over a tile before its strength shifts. Effort is weighted by distance traveled, with a time component to prevent stationary spoofing.

**GPS Smoothing + Anti-Cheat**
Raw GPS coordinates are smoothed using an exponential moving average (α = 0.45) before being accepted. Server-side validation rejects points that exceed plausible human speeds, jump unrealistic distances, or arrive too quickly — ensuring territory is earned legitimately.

**Batched Uploads**
GPS points are batched client-side every 6 intervals (~18 seconds) and sent as a single request, reducing server load while keeping territory state accurate.

**Run State Machine**
Activity tracking follows a strict phase model: `idle → active → paused → ending → idle`. Each transition is explicit, preventing partial state and making the tracker resilient to backgrounding and interruptions.

**Real-Time Tile Sync**
When a tile changes ownership, the backend broadcasts a `tile_updated` Socket.io event to all connected clients. The frontend merges incoming tiles into its Zustand store without re-fetching the full viewport.

**Tile Decay**
A scheduled server job reduces tile strength by 1 every 6 hours. Territory that isn't actively defended weakens over time — rewarding consistent play.

---

## Project Structure

```
Frontend/
├── app/
│   ├── (tabs)/
│   │   ├── index.tsx       # Live territory map
│   │   ├── run.tsx         # GPS tracking + run controls
│   │   ├── leaderboard.tsx # Rankings
│   │   ├── feed.tsx        # Social posts + runs
│   │   └── profile.tsx     # User stats
│   ├── welcome.tsx         # Onboarding
│   ├── run-summary.tsx     # Post-run results
│   └── post-detail.tsx     # Comments view
├── src/
│   ├── components/         # Shared UI components
│   ├── hooks/
│   │   ├── useRunTracker.ts  # GPS tracking, smoothing, batching
│   │   └── useTilesSocket.ts # Real-time tile subscription
│   ├── services/
│   │   ├── api.ts            # Typed Axios client
│   │   └── socket.ts         # Socket.io connection
│   ├── store/                # Zustand slices
│   └── utils/geo.ts          # Haversine, viewport helpers

Backend/
├── src/
│   ├── routes/             # Express route handlers
│   ├── services/
│   │   └── tiles.service.ts  # Capture logic, effort calculation
│   ├── models/store.ts       # Supabase data layer
│   └── sockets/              # WebSocket event broadcasting
```

---

## Running Locally

### Prerequisites
- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator / Android Emulator or a physical device

### Frontend

```bash
cd Frontend
npm install
npx expo start
```

### Backend

```bash
cd Backend
npm install
cp .env.example .env   # Add your Supabase credentials and JWT secret
npm run dev
```

Set `EXPO_PUBLIC_API_URL` in your Expo environment to point at the running backend.

---

## Key Design Decisions

- **Dark mode enforced** — no light mode. The map is always dark, keeping visual focus on owned territory.
- **No third-party auth dependency** — authentication is JWT-based with secure on-device storage, keeping the auth flow lightweight.
- **Platform-aware map rendering** — iOS uses HybridFlyover for 3D run mode; Android uses a custom dark map style. Each platform gets the best experience it can deliver.
- **Minimal re-renders** — Zustand selectors are scoped to the exact slice of state each component needs. Map tile overlays only re-render when their specific tile changes.

---

## Activity Modes

| Mode | Strength Gain | Accent Color |
|---|---|---|
| Walk | +1 per tile | Cyan |
| Run | +2 per tile | Orange |

Running rewards more territory per step but demands more physical effort — a deliberate balance between accessibility and competitive advantage.

---

Built with React Native + Expo · TypeScript throughout · Real-time via Socket.io · Territory via Uber H3
