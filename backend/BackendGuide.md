# Backend Guide — Territory Run 🧠⚙️

## 🎯 Goal

Handle:

* GPS data processing
* Tile ownership logic
* Realtime updates
* Anti-cheat validation

---

## 🛠️ Tech Stack

* Node.js + Express
* MongoDB (GeoJSON support)
* Socket.io (realtime)
* Redis (optional, for caching)

---

## 📁 Folder Structure

src/
├── controllers/
├── routes/
├── models/
├── services/
├── utils/
├── sockets/
└── middlewares/

---

## 🗄️ Database Design

### 📍 Tile Schema

{
tileId: string,
coordinates: { lat: number, lng: number },
ownerId: string,
strength: number,
lastUpdated: Date
}

---

### 🏃 Run Schema

{
userId: string,
path: [ { lat, lng, timestamp } ],
distance: number,
duration: number,
createdAt: Date
}

---

### 👤 User Schema

{
username: string,
totalDistance: number,
territoryCount: number,
rank: number
}

---

## 🧠 Core Logic

### 1. GPS → Tile Mapping

* Convert lat/lng → tile index
* Use grid system (e.g., 50m tiles)

👉 Store tile as:
tileX = floor(lat / tileSize)
tileY = floor(lng / tileSize)

---

### 2. Tile Update Algorithm

For each tile visited:

IF tile is empty:
assign owner
strength = base

ELSE IF same owner:
increase strength

ELSE:
decrease strength
IF strength <= 0:
change owner

---

### 3. Effort Calculation

effort =
(time_in_tile * weight1) +
(distance_in_tile * weight2)

---

### 4. Anti-Cheat System 🚨

Reject updates if:

* Speed > 20 km/h
* GPS jump too large
* Inconsistent timestamps

---

## 📡 API Design

### 🏁 Run Flow

POST /run/start
→ create run session

POST /run/update
→ send GPS batch

POST /run/end
→ process tiles

---

### 🗺️ Tiles

GET /tiles?bbox=...
→ return only visible tiles

---

### 🏆 Leaderboard

GET /leaderboard

---

## 🔄 Realtime (Socket.io)

Emit:

* tile_updated
* territory_changed

Clients subscribe based on region

---

## ⚡ Performance Strategy

* Use bounding box queries
* Index tiles (Geo index)
* Batch GPS processing (don’t process per point)

---

## 🧪 Scaling Plan

Phase 1:

* Single server
* Basic Mongo queries

Phase 2:

* Redis caching
* Worker queues for processing runs

Phase 3:

* Microservices (tiles, runs, users)

---

## ⏳ Tile Decay Job

Run every few hours:

FOR each tile:
reduce strength
IF strength <= 0:
make neutral

---

## 🚀 MVP Checklist

* [ ] Save runs
* [ ] Map GPS → tiles
* [ ] Update tile ownership
* [ ] Return tiles via API
* [ ] Basic anti-cheat

---

## 💡 Final Advice

Backend is not just CRUD.

You are building:
👉 a **game engine for the real world**

Keep logic:

* Deterministic
* Fair
* Hard to exploit

Everything else is secondary.
