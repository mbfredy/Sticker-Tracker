/*
 * World Cup 2026 Panini album — sticker data.
 *
 * THIS FILE IS THE SOURCE OF TRUTH for what stickers exist in the album.
 * It is built from photos of the real album pages, group by group.
 *
 * Structure:
 *   ALBUM.sections  -> non-team pages (intro, legends, stadiums, badges, etc.)
 *   ALBUM.groups    -> the 12 tournament groups (A–L), each with its countries.
 *
 * Status (have / missing / how many duplicates) is NOT stored here — that lives
 * in the browser (localStorage), keyed by sticker `num`. This file only
 * describes the album itself, so it can be updated without losing your marks.
 */

// Build a team's 20-sticker page. `prefix` is the printed code (e.g. "MEX"),
// `iso` is the 2-letter country code used for the flag emoji. `names` is an
// optional map of { stickerNumber: "Player name" } for the ones we can read.
function team(prefix, iso, name, count, names) {
  names = names || {};
  const stickers = [];
  for (let i = 1; i <= count; i++) {
    stickers.push({
      num: prefix + " " + i,
      name: names[i] || "",
      type: "player",
    });
  }
  return { code: iso, name: name, stickers: stickers };
}

const ALBUM = {
  meta: {
    title: "World Cup 2026 — Panini Sticker Album",
    edition: "FIFA World Cup 2026",
    note: "Group A added from album photos. Player names + remaining groups to follow.",
  },

  // Non-team pages: intro, legends, stadiums, etc. (filled in from front/back pages).
  sections: [
    { id: "intro", name: "Introduction & Tournament", icon: "🏆", stickers: [] },
    { id: "stadiums", name: "Host Cities & Stadiums", icon: "🏟️", stickers: [] },
    { id: "legends", name: "Legends", icon: "⭐", stickers: [] },
  ],

  // The 12 groups of the 2026 World Cup (48 teams, 4 per group).
  groups: [
    {
      id: "A",
      teams: [
        // Group A — confirmed from album photos. 20 stickers per team.
        // Player names to be added from the album's checklist page.
        team("MEX", "MX", "Mexico", 20),
        team("RSA", "ZA", "South Africa", 20),
        team("KOR", "KR", "Korea Republic", 20),
        team("CZE", "CZ", "Czechia", 20),
      ],
    },
    { id: "B", teams: [] },
    { id: "C", teams: [] },
    { id: "D", teams: [] },
    { id: "E", teams: [] },
    { id: "F", teams: [] },
    { id: "G", teams: [] },
    { id: "H", teams: [] },
    { id: "I", teams: [] },
    { id: "J", teams: [] },
    { id: "K", teams: [] },
    { id: "L", teams: [] },
  ],
};

// Expose for app.js.
if (typeof window !== "undefined") window.ALBUM = ALBUM;
