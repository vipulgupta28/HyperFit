# Frontend Guide — Territory Run 🗺️🏃

## 🎯 Goal

Build a smooth, addictive mobile experience where users:

* Track runs
* See tiles captured in real-time
* Interact with a game-like map

---

## 🛠️ Tech Stack

* React Native (Expo recommended)
* Mapbox GL / React Native Maps
* Zustand / Redux (state management)
* Axios (API calls)
* Socket.io-client (realtime updates)

---

## 📁 Folder Structure

src/
├── components/
├── screens/
├── hooks/
├── store/
├── services/
├── utils/
└── constants/

---

## 📱 Core Screens

### 1. Home / Map Screen (MOST IMPORTANT)

* Fullscreen map
* Show:

  * User location (blue dot)
  * Captured tiles (colored squares)
  * Other players (optional)

#### Responsibilities:

* Render tiles efficiently (use clustering / memoization)
* Subscribe to realtime updates

---

### 2. Run Screen

* Start / Pause / Stop run
* Track GPS path
* Show:

  * Distance
  * Time
  * Pace

#### Key Logic:

* Capture GPS points every 2–5 sec
* Send batch to backend

---

### 3. Post-Run Summary

* Tiles captured
* Territory gained/lost
* Stats (distance, calories)

---

### 4. Profile Screen

* Total territory owned
* Leaderboard rank
* Run history

---

## 🧩 Core Components

### 🗺️ Tile Component

* Square overlay on map
* Props:

  * coordinates
  * ownerColor
  * strength

---

### 🏃 Run Tracker Hook (`useRunTracker`)

Handles:

* GPS tracking
* Path smoothing
* Speed validation

---

### 🔄 Realtime Hook (`useTilesSocket`)

* Listen for tile updates
* Update UI instantly

---

## 📡 API Integration

### Example Endpoints:

POST /run/start
POST /run/update
POST /run/end
GET /tiles?bbox=...

---

## ⚡ Performance Tips (VERY IMPORTANT)

* Do NOT render thousands of tiles at once
* Use:

  * Bounding box queries (only visible tiles)
  * Debouncing map movement
  * Memoization

---

## 🎨 UI/UX Rules

* Dark theme (feels more “game-like”)
* Smooth animations (Framer Motion / Reanimated)
* Instant feedback on tile capture

---

## 🚨 Edge Cases

* GPS loss → pause tracking
* Sudden jumps → ignore (anti-cheat)
* Background tracking (handle permissions properly)

---

## 🧪 Dev Tips

* Simulate GPS (Expo location tools)
* Start with static tiles before realtime
* Keep map logic separate from UI

---

## 🚀 MVP Checklist

* [ ] Map renders tiles
* [ ] User can start/stop run
* [ ] GPS path tracked
* [ ] Tiles captured after run
* [ ] Basic leaderboard

---

## 💡 Final Advice

Focus on:

* Smooth map experience
* Accurate tracking
* Instant visual reward

This is not just UI — it’s a **game loop**.
