# Scroll — Build Plan

An ironic iOS app about infinite scrolling. You scroll, you earn points, the void shifts color, and when you stop, it shames you.

> **Note:** This repository is unrelated (a JS breakout game). The Xcode project will live in a fresh repo. This document is the design spec.

---

## 1. Stack

- **Language / UI:** Swift 5.9, SwiftUI
- **Platforms:** iOS 17+, universal (iPhone + iPad)
- **Backend:** Firebase (Firestore for leaderboard, Anonymous Auth for stable per-install user IDs)
- **Audio:** AVFoundation
- **Haptics:** CoreHaptics
- **Graphics:** Metal shader for grainy background noise
- **Package manager:** Swift Package Manager
- **No Game Center** in v1 (can add later as a second leaderboard)

---

## 2. Core mechanics

### 2.1 Scroll engine

- Full-screen `ScrollView` with an extremely tall virtual content (~1B px). Content itself is invisible; the scroll is purely mechanical.
- Native SwiftUI momentum / deceleration handles the feel.
- Each frame, compute `delta = |offset_now − offset_prev|`.
- **Points awarded:** `points += delta × speedMultiplier(velocity)`. Faster scroll yields more points per pixel (superlinear in velocity), so vigorous flicking is rewarded.
- Points are rounded down to integers for display.

### 2.2 Session end — "KEEP SCROLLING" countdown

Triggered as soon as scroll velocity drops to zero and no new scroll input occurs.

1. A `"KEEP SCROLLING"` banner flashes.
2. A 6-second countdown begins.
3. At **3 seconds remaining**, the background shifts to an angry, saturated red (overriding the current hue) and pulses.
4. Any new scroll input **cancels the countdown**, restores the background color, and resumes the session.
5. At **0**, the session ends: session score is written to the leaderboard, and the shame popup appears.

### 2.3 Color engine

- Background hue advances with lifetime scroll distance.
- A **full 360° hue rotation = 24 hours of active scrolling**. We track `activeScrollSeconds` (only accumulates while actually scrolling) and map it to hue.
- Rendering: `TimelineView` + `Canvas` filling the screen with an HSB color; a Metal fragment shader overlays animated Perlin/value noise at low amplitude to produce a "grainy pleasant" matte texture. Saturation and brightness kept gentle (`S ≈ 0.45`, `B ≈ 0.85`) so it never screams.
- **Loop counter:** persisted in `UserDefaults` as `loopsCompleted: Int`. Incremented each time hue wraps past 360°.
- **Loop transition moment:** at the exact wrap, a brief shimmer/pulse animation (~1.5s) plays — designed to be screenshot-worthy. The loop badge in the HUD updates with a little sparkle.

### 2.4 Ding scheduler

- A "ding" fires when cumulative session points cross each next 1000-point threshold.
- **Rate-limited by a minimum interval that grows parabolically over the session, without a ceiling:**
  - `minInterval(n) = 30 + k · n²` seconds, where `n` = dings earned this session.
  - `k` tuned so `n ≈ 35` yields ≈ 300 s (5 min). Beyond that, it keeps climbing — scrolling gets harder forever.
- If a 1000-point threshold is crossed before the min interval elapses, the ding is deferred until the interval expires.
- Each ding plays `ding.wav` and triggers a light haptic tap.

### 2.5 Shame popup

Appears on session end.

- Headline: `"(X) points: Not Quite Enough…"` (same every time; X = session score)
- Body: session score, updated lifetime total, personal best (with "NEW!" badge if beaten), global rank, loops this session.
- CTA: `Scroll Again`.

---

## 3. Leaderboard

- Firestore collection `scores`, one document per user keyed by `uid`:
  ```
  {
    uid: String,
    displayName: String,
    bestSessionPoints: Int,
    lifetimePoints: Int,
    loopsCompleted: Int,
    lastSessionAt: Timestamp
  }
  ```
- On each session end, update the user's doc (bump `lifetimePoints`, set `bestSessionPoints = max(old, new)`, update `loopsCompleted`).
- **Queries:**
  - Top 100 globally by `bestSessionPoints` desc.
  - User's own rank (count docs with score > user's).
- **Auth:** Firebase Anonymous Auth on first launch → stable `uid`. User picks display name on first launch; editable in Settings.

---

## 4. HUD (always on screen)

Top-right corner:
- Current session points (large)
- Loop badge: `↻ N`

Top-left:
- Personal best
- `#1` global (name + score)

Bottom: tiny "pull down for leaderboard" affordance.

---

## 5. Screens

1. **Name entry** — first launch, blocks until a name is chosen.
2. **Main void** — the scroller + HUD.
3. **Leaderboard** — pulled down from main view, shows top 100 + your rank.
4. **Shame popup** — modal sheet at session end.
5. **Settings** — change name, mute audio/haptics, reset local stats (not lifetime on server).

---

## 6. File layout

```
Scroll/
├── ScrollApp.swift              # @main entry
├── Models/
│   ├── ScoreState.swift         # session + lifetime points, observable
│   ├── ColorEngine.swift        # hue math, loop detection
│   ├── DingScheduler.swift      # parabolic interval, threshold tracking
│   ├── SessionController.swift  # 6s countdown, scroll idle detection
│   └── UserIdentity.swift       # uid, display name
├── Views/
│   ├── VoidView.swift           # main scroller
│   ├── GrainyBackground.swift   # SwiftUI wrapper for Metal grain shader
│   ├── HUDView.swift
│   ├── CountdownOverlay.swift   # "KEEP SCROLLING" + red flash
│   ├── ShamePopup.swift
│   ├── LeaderboardView.swift
│   └── NameEntryView.swift
├── Services/
│   ├── LeaderboardClient.swift  # Firestore wrapper
│   ├── AudioPlayer.swift
│   └── HapticsEngine.swift
├── Shaders/
│   └── Grain.metal
├── Resources/
│   └── ding.wav
└── Persistence/
    └── LocalStore.swift         # UserDefaults wrapper
```

---

## 7. Milestones

1. **Xcode project skeleton** — fresh repo, SwiftUI shell, Firebase wired up, name entry screen.
2. **Scroll engine** — infinite ScrollView, velocity-scaled point counting, HUD showing session points.
3. **Color engine + grain shader** — hue progression, Metal grain, loop counter + shimmer transition.
4. **Session lifecycle** — "KEEP SCROLLING" countdown, 3-sec red alert, session end handoff.
5. **Ding scheduler** — parabolic intervals, audio playback, haptics.
6. **Shame popup** — session-end modal, rank/best/loops display.
7. **Leaderboard** — Firestore schema, top-100 query, user rank query, pull-down view.
8. **Settings + polish** — mute, rename, iPad layout, App Store assets, TestFlight.

---

## 8. Tuning parameters (initial guesses, to adjust during build)

| Parameter | Value | Notes |
|---|---|---|
| Points per pixel (baseline) | 0.1 | At slow scroll |
| Velocity multiplier exponent | 1.3 | `pts = Δ·(v/vRef)^1.3` |
| Countdown on idle | 6.0 s | |
| Red-alert threshold | 3.0 s remaining | |
| Ding base interval | 30 s | |
| Ding parabolic k | ~0.22 | so n=35 → 300 s |
| Hue cycle | 86,400 s active scroll | 24 h |
| Grain amplitude | 0.04 | barely visible |
| Baseline saturation / brightness | 0.45 / 0.85 | |

---

## 9. Out of scope for v1

- Push notifications
- Friends / follows
- Achievements
- Paid cosmetics
- Game Center
- Android / web
