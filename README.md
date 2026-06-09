# World Cup 2026 — Panini Sticker Tracker

A mobile-friendly web app to track your World Cup 2026 Panini album: see what
you **have**, what's **missing**, and which **duplicates** you can trade —
organized by group (A–L) and country.

## Features

- 📖 **Album view** — every sticker, grouped by Group → Country.
- 👆 **Tap to update** — tap a sticker to cycle **Missing → Have**. When you
  have it, use **+ / −** to count your **spare duplicates**.
- 🤝 **Trade view** — auto-generates two copy-paste lists:
  - *Stickers I need* (your wishlist)
  - *My spares to trade* (your duplicates, with quantities)
- 📊 **Progress bars** per team and overall.
- 🔎 **Search** by sticker number, player name, or country.
- 🔁 **Filters** — All / Missing / Spares.
- 💾 **Saves on your device** (localStorage) + **Backup / Restore** as a JSON
  file so you can move it between phones or keep it safe.

## How to use it

Just open `index.html` in a browser. Nothing to install.

To use it on your phone from anywhere, host it free with **GitHub Pages**
(Settings → Pages → deploy from this branch); then open the URL on your phone
and add it to your home screen.

## The sticker list

The full list of stickers lives in [`data.js`](./data.js). It is being built
from photos of the real album pages. The current list is a small sample so the
app renders — it gets replaced with the actual stickers, group by group.

## Files

| File         | What it is                                            |
|--------------|-------------------------------------------------------|
| `index.html` | Page structure                                        |
| `styles.css` | Styling (dark, mobile-first)                          |
| `app.js`     | App logic (state, rendering, trade lists, backup)     |
| `data.js`    | The album definition — groups, countries, stickers    |

Your Have/Missing/duplicate marks are **not** stored in these files — they live
in your browser, so the data files can be updated without losing your progress.
