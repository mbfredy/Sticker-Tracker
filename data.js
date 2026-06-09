/*
 * World Cup 2026 Panini album — sticker data.
 *
 * THIS FILE IS THE SOURCE OF TRUTH for what stickers exist in the album.
 * It gets filled in from photos of the real album pages.
 *
 * Structure:
 *   ALBUM.sections  -> non-team pages (intro, legends, stadiums, badges, etc.)
 *   ALBUM.groups    -> the 12 tournament groups (A–L), each with its countries.
 *
 * Each country has a `stickers` array. Each sticker:
 *   { num: "ARG3", name: "L. Messi", type: "player" }
 *     num  -> the printed sticker number/code (string, keep exactly as printed)
 *     name -> player name or label ("Team badge", "Logo / Foil", etc.)
 *     type -> "player" | "badge" | "logo" | "team" | "stadium" | "legend" | "special"
 *
 * Status (have / missing / how many duplicates) is NOT stored here — that lives
 * in the browser (localStorage), keyed by sticker `num`. This file only
 * describes the album itself.
 *
 * NOTE: The lists below are a SAMPLE so the app renders. They will be replaced
 * with the real stickers read from the album page photos.
 */

const ALBUM = {
  meta: {
    title: "World Cup 2026 — Panini Sticker Album",
    edition: "FIFA World Cup 2026",
    note: "Sticker list is being built from album photos.",
  },

  // Non-team pages: intro, tournament, legends, stadiums, etc.
  // Filled in from the front/back pages of the album.
  sections: [
    {
      id: "intro",
      name: "Introduction & Tournament",
      icon: "🏆",
      stickers: [
        // e.g. { num: "1", name: "Official Emblem", type: "special" },
      ],
    },
    {
      id: "stadiums",
      name: "Host Cities & Stadiums",
      icon: "🏟️",
      stickers: [],
    },
    {
      id: "legends",
      name: "Legends",
      icon: "⭐",
      stickers: [],
    },
  ],

  // The 12 groups of the 2026 World Cup (48 teams, 4 per group).
  // Country `code` is an ISO alpha-2 used to render the flag emoji.
  // Teams + sticker lists get filled in from the album photos.
  groups: [
    {
      id: "A",
      teams: [
        // SAMPLE team so the layout is visible — replace with real album data.
        {
          code: "MX",
          name: "Mexico",
          stickers: [
            { num: "MEX1", name: "Team badge", type: "badge" },
            { num: "MEX2", name: "Logo / Foil", type: "logo" },
            { num: "MEX3", name: "Line-up (left)", type: "team" },
            { num: "MEX4", name: "Line-up (right)", type: "team" },
            { num: "MEX5", name: "Player", type: "player" },
            { num: "MEX6", name: "Player", type: "player" },
            { num: "MEX7", name: "Player", type: "player" },
            { num: "MEX8", name: "Player", type: "player" },
          ],
        },
        { code: "TBD", name: "Team 2 — TBD", stickers: [] },
        { code: "TBD", name: "Team 3 — TBD", stickers: [] },
        { code: "TBD", name: "Team 4 — TBD", stickers: [] },
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

// Expose for app.js (works both as a plain <script> and if ever bundled).
if (typeof window !== "undefined") window.ALBUM = ALBUM;
