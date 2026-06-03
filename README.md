# TfL Bus Arrivals Card

A compact, live bus arrival countdown card for Home Assistant. Shows real-time "minutes until arrival" for a specific bus stop, grouped by direction.

Perfect for monitoring your local bus stop from your HA dashboard.

## Preview

```
┌──────────────────────────────────┐
│ 186  Belmont Lane                │  ← red TfL bus header
├──────────────────────────────────┤
│ → Brent Cross        4 min 12 min│
│ → Northwick Park     8 min 22 min│
└──────────────────────────────────┘
```

## Features

- 🚌 **Live Countdown**: Real-time bus arrival times that tick down between API polls.
- ⚡ **Zero-Config API Access**: Fetches directly from the TfL StopPoint Arrivals API — no keys required.
- 📐 **Compact**: ~100px total height — fits neatly in small dashboard tiles.
- 🔴 **"Due" Badge**: Buses arriving within 60 seconds get a red "due" indicator.
- 🔧 **Configurable**: Filter by bus line, set max arrivals per direction (default 2, configurable up to any number), and adjust polling intervals.

---

## Installation (HACS)

1. Open **HACS** in your Home Assistant panel.
2. Click **⋮** (top right) → **Custom repositories**.
3. Paste the URL of this repository.
4. Set the Type to **Dashboard**.
5. Click **Add**.
6. Find "TfL Bus Arrivals Card" in HACS, click **Download**, and restart your frontend if prompted.

## Manual Installation

1. Download `ha-tfl-bus-card.js`.
2. Upload it to `/config/www/ha-tfl-bus-card.js`.
3. Add the Lovelace resource:
   - **Settings** → **Dashboards** → **⋮** → **Resources** → **Add Resource**.
   - URL: `/local/ha-tfl-bus-card.js`
   - Type: **JavaScript Module**

---

## Configuration

Add a manual card to your dashboard:

### Basic (186 at Belmont Lane, both directions)

```yaml
type: custom:ha-tfl-bus-card
stops:
  - "490003865E"
  - "490003865W"
line: "186"
```

### With Custom Labels

```yaml
type: custom:ha-tfl-bus-card
title: "My Bus Stop"
stops:
  - id: "490003865E"
    label: "Brent Cross"
  - id: "490003865W"
    label: "Northwick Park"
line: "186"
```

### More Arrivals

```yaml
type: custom:ha-tfl-bus-card
stops:
  - "490003865E"
  - "490003865W"
line: "186"
max_arrivals: 4
```

---

## Configuration Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| **`type`** | string | **Required** | Must be `custom:ha-tfl-bus-card` |
| **`stops`** | list | **Required** | Stop IDs to display. Each can be a string or `{ id, label }` object. |
| **`line`** | string | `null` | Filter to a specific bus line (e.g. `"186"`). Shows all lines at the stop if omitted. |
| **`title`** | string | *auto* | Custom card title. Auto-detected from the API if not set. |
| **`max_arrivals`** | number | `2` | Maximum arrivals shown per stop/direction. |
| **`update_interval`** | number | `30` | API polling frequency in seconds. |
| **`api_key`** | string | `null` | Optional TfL API key for higher rate limits. |

## Finding Stop IDs

You can find TfL stop IDs from the URL on the [TfL website](https://tfl.gov.uk). For example:

- `https://tfl.gov.uk/bus/stop/490003865E/belmont-lane` → Stop ID: `490003865E`
- `https://tfl.gov.uk/bus/stop/490003865W/belmont-lane` → Stop ID: `490003865W`

The suffix `E` / `W` / `N` / `S` typically indicates the direction of travel.
