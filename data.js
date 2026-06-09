/*
 * World Cup 2026 Panini album — sticker data.
 *
 * THIS FILE IS THE SOURCE OF TRUTH for what stickers exist in the album.
 * Built from photos of the real album pages — all 12 groups, 48 teams,
 * 20 stickers per team.
 *
 * Status (have / missing / duplicates) is NOT stored here — that lives in the
 * browser (localStorage), keyed by sticker `num`. This file only describes the
 * album, so it can be updated without losing your marks.
 */

// One team page = `count` numbered stickers ("MEX 1" … "MEX 20").
//   prefix -> printed sticker code (e.g. "MEX")
//   iso    -> 2-letter country code for the flag emoji
//   flag   -> optional emoji override (for non-ISO flags like England/Scotland)
function team(prefix, iso, name, flag, count) {
  count = count || 20;
  const stickers = [];
  for (let i = 1; i <= count; i++) {
    stickers.push({ num: prefix + " " + i, name: "", type: "player" });
  }
  return { code: iso, name: name, flag: flag || null, stickers: stickers };
}

const ALBUM = {
  meta: {
    title: "World Cup 2026 — Panini Sticker Album",
    edition: "FIFA World Cup 2026",
    note: "All 12 groups added from album photos. 20 stickers per team.",
  },

  // Non-team pages (intro, stadiums, legends). Filled in from front/back pages.
  sections: [
    { id: "intro", name: "Introduction & Tournament", icon: "🏆", stickers: [] },
    { id: "stadiums", name: "Host Cities & Stadiums", icon: "🏟️", stickers: [] },
    { id: "legends", name: "Legends", icon: "⭐", stickers: [] },
  ],

  // 12 groups, 4 teams each, in the order shown in the album spreads.
  groups: [
    { id: "A", teams: [
      team("MEX", "MX", "Mexico"),
      team("RSA", "ZA", "South Africa"),
      team("KOR", "KR", "Korea Republic"),
      team("CZE", "CZ", "Czechia"),
    ] },
    { id: "B", teams: [
      team("CAN", "CA", "Canada"),
      team("BIH", "BA", "Bosnia-Herzegovina"),
      team("QAT", "QA", "Qatar"),
      team("SUI", "CH", "Switzerland"),
    ] },
    { id: "C", teams: [
      team("BRA", "BR", "Brazil"),
      team("MAR", "MA", "Morocco"),
      team("HAI", "HT", "Haiti"),
      team("SCO", "GB", "Scotland", "🏴󠁧󠁢󠁳󠁣󠁴󠁿"),
    ] },
    { id: "D", teams: [
      team("USA", "US", "USA"),
      team("PAR", "PY", "Paraguay"),
      team("AUS", "AU", "Australia"),
      team("TUR", "TR", "Türkiye"),
    ] },
    { id: "E", teams: [
      team("GER", "DE", "Germany"),
      team("CUW", "CW", "Curaçao"),
      team("CIV", "CI", "Côte d'Ivoire"),
      team("ECU", "EC", "Ecuador"),
    ] },
    { id: "F", teams: [
      team("NED", "NL", "Netherlands"),
      team("JPN", "JP", "Japan"),
      team("SWE", "SE", "Sweden"),
      team("TUN", "TN", "Tunisia"),
    ] },
    { id: "G", teams: [
      team("BEL", "BE", "Belgium"),
      team("EGY", "EG", "Egypt"),
      team("IRN", "IR", "IR Iran"),
      team("NZL", "NZ", "New Zealand"),
    ] },
    { id: "H", teams: [
      team("ESP", "ES", "Spain"),
      team("CPV", "CV", "Cabo Verde"),
      team("KSA", "SA", "Saudi Arabia"),
      team("URU", "UY", "Uruguay"),
    ] },
    { id: "I", teams: [
      team("FRA", "FR", "France"),
      team("SEN", "SN", "Senegal"),
      team("IRQ", "IQ", "Iraq"),
      team("NOR", "NO", "Norway"),
    ] },
    { id: "J", teams: [
      team("ARG", "AR", "Argentina"),
      team("ALG", "DZ", "Algeria"),
      team("AUT", "AT", "Austria"),
      team("JOR", "JO", "Jordan"),
    ] },
    { id: "K", teams: [
      team("POR", "PT", "Portugal"),
      team("COD", "CD", "Congo DR"),
      team("UZB", "UZ", "Uzbekistan"),
      team("COL", "CO", "Colombia"),
    ] },
    { id: "L", teams: [
      team("ENG", "GB", "England", "🏴󠁧󠁢󠁥󠁮󠁧󠁿"),
      team("CRO", "HR", "Croatia"),
      team("GHA", "GH", "Ghana"),
      team("PAN", "PA", "Panama"),
    ] },
  ],
};

if (typeof window !== "undefined") window.ALBUM = ALBUM;
