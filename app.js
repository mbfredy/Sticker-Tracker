/*
 * World Cup 2026 Panini sticker tracker — app logic.
 *
 * State: per sticker `num` -> { have:bool, dupes:int }. Default = missing.
 * Saved to localStorage. Album definition is in data.js; the pre-filled
 * collection read from photos is in seed.js (window.SEED).
 */

(function () {
  "use strict";

  const OWNER_KEY = "wc2026-stickers-v1";  // the owner's (seeded) collection
  const MINE_KEY = "wc2026-mine-v1";       // a visitor's own blank album
  const UNLOCK_KEY = "wc2026-edit";
  const PERSONAL_KEY = "wc2026-personal";
  const SEEDV_KEY = "wc2026-seedv";        // which seed version is applied here
  const ALBUM = window.ALBUM;
  const EDIT_HASH = (window.APP_CONFIG || {}).editHash || "";

  // Personal mode = the visitor is keeping their OWN blank album on this device
  // (separate storage, no seed, freely editable). Otherwise it's the owner's
  // shared collection: read-only until unlocked with the password.
  let personalMode = localStorage.getItem(PERSONAL_KEY) === "1";
  let editUnlocked = personalMode ? true : localStorage.getItem(UNLOCK_KEY) === "1";

  function storeKey() { return personalMode ? MINE_KEY : OWNER_KEY; }
  function loadState() {
    try { return JSON.parse(localStorage.getItem(storeKey())) || {}; }
    catch { return {}; }
  }
  function saveState() { localStorage.setItem(storeKey(), JSON.stringify(state)); }
  function getSt(num) { return state[num] || { have: false, dupes: 0 }; }

  // Owner mode: apply the published collection (seed) read from photos + the
  // owner's duplicates. Versioned — when a newer seed is published the entries
  // refresh on the device; once applied it leaves the owner's state alone so
  // their own taps persist between updates.
  function applySeed(st) {
    const seed = window.SEED || {};
    const ver = window.SEED_VERSION || 1;
    const applied = +(localStorage.getItem(SEEDV_KEY) || 0);
    if (applied >= ver) return st; // already up to date
    for (const num in seed) {
      st[num] = { have: !!seed[num].have, dupes: seed[num].dupes || 0 };
    }
    localStorage.setItem(storeKey(), JSON.stringify(st));
    localStorage.setItem(SEEDV_KEY, String(ver));
    return st;
  }

  // ---- State ---------------------------------------------------------------
  let state = personalMode ? loadState() : applySeed(loadState());
  let filter = "all";       // all | missing | dupes
  let query = "";
  let view = "album";       // album | trade | compare
  let compareMode = "have"; // friend's pasted list is what they HAVE or NEED
  let pressTimer = null;     // long-press timer for spares
  let suppressClickUntil = 0; // guard so a long-press doesn't also fire a tap
  const expandedTeams = new Set(); // which team rows the user has opened

  // ---- Indexes (built once) ------------------------------------------------
  const ALL = [];                 // every sticker with context
  const BY_CODE = {};             // "MEX12" -> sticker entry
  const COUNTRIES = [];           // { name, flag, code, group, stickers[] }

  function buildIndexes() {
    (ALBUM.sections || []).forEach((s) =>
      (s.stickers || []).forEach((st) => addSticker(st, s.name, "", "•", ""))
    );
    (ALBUM.groups || []).forEach((g) =>
      (g.teams || []).forEach((t) => {
        const flag = t.flag || flagEmoji(t.code);
        COUNTRIES.push({ name: t.name, flag: flag, code: t.code, group: g.id, team: t });
        (t.stickers || []).forEach((st) => addSticker(st, t.name, flag, g.id, t.name));
      })
    );
  }
  function addSticker(st, ctx, flag, group, country) {
    const entry = { num: st.num, name: st.name, ctx, flag, group, country };
    ALL.push(entry);
    BY_CODE[norm(st.num)] = entry;
  }
  function norm(s) { return String(s).toUpperCase().replace(/[^A-Z0-9]/g, ""); }

  function flagEmoji(code) {
    if (!code || code.length !== 2 || code === "TB") return "🏳️";
    const A = 0x1f1e6, up = code.toUpperCase();
    return String.fromCodePoint(A + up.charCodeAt(0) - 65, A + up.charCodeAt(1) - 65);
  }

  // ---- Search resolution ---------------------------------------------------
  // Returns one of:
  //   {type:'sticker', entry}        exact code like mex12
  //   {type:'country', country}      a country name / prefix like "mex" or "brazil"
  //   {type:'filter', q}             generic text/number filter
  //   {type:'none'}                  empty query
  function resolveSearch(raw) {
    const q = raw.trim();
    if (!q) return { type: "none" };
    const n = norm(q);

    if (BY_CODE[n]) return { type: "sticker", entry: BY_CODE[n] };

    // Letters-only that match a country's code prefix (e.g. "mex", "bra").
    if (/^[A-Z]+$/.test(n)) {
      const byPrefix = COUNTRIES.find((c) => norm(firstPrefix(c)) === n);
      if (byPrefix) return { type: "country", country: byPrefix };
    }
    // Country name match (contains).
    const ql = q.toLowerCase();
    const byName = COUNTRIES.find((c) => c.name.toLowerCase().includes(ql) && ql.length >= 3);
    if (byName) return { type: "country", country: byName };

    return { type: "filter", q: ql };
  }
  function firstPrefix(country) {
    const s = (country.team.stickers || [])[0];
    return s ? s.num.split(" ")[0] : country.code;
  }

  // ---- Rendering -----------------------------------------------------------
  const elMain = document.getElementById("main");
  const elNav = document.getElementById("groupNav");
  const elFilters = document.getElementById("filters");
  const elSearchResult = document.getElementById("searchResult");

  function render() {
    elNav.classList.toggle("hidden", view !== "album");
    elFilters.classList.toggle("hidden", view !== "album");
    if (view === "trade") { elSearchResult.classList.add("hidden"); renderTrade(); }
    else if (view === "compare") { elSearchResult.classList.add("hidden"); renderCompare(); }
    else renderAlbum();
  }

  function computeStats() {
    let have = 0, spares = 0;
    ALL.forEach((s) => { const st = getSt(s.num); if (st.have) have++; if (st.dupes > 0) spares += st.dupes; });
    const total = ALL.length;
    return { total, have, missing: total - have, spares, pct: total ? Math.round((have / total) * 100) : 0 };
  }

  // Big completion ring + headline stats at the top of the album.
  function buildDashboard() {
    const s = computeStats();
    const r = 42, circ = 2 * Math.PI * r, off = circ * (1 - s.pct / 100);
    const d = document.createElement("div");
    d.className = "dashboard";
    d.innerHTML =
      `<div class="ring">` +
        `<svg viewBox="0 0 96 96">` +
          `<defs><linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">` +
            `<stop offset="0" stop-color="#ff3d8b"/><stop offset="0.5" stop-color="#4d8bff"/><stop offset="1" stop-color="#1fc46a"/>` +
          `</linearGradient></defs>` +
          `<circle class="ring-bg" cx="48" cy="48" r="${r}"></circle>` +
          `<circle class="ring-fg" cx="48" cy="48" r="${r}" stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"></circle>` +
        `</svg>` +
        `<div class="ring-label"><b>${s.pct}%</b><span>complete</span></div>` +
      `</div>` +
      `<div class="dash-stats">` +
        `<div class="ds collected"><b>${s.have}</b><span>collected</span></div>` +
        `<div class="ds missing"><b>${s.missing}</b><span>missing</span></div>` +
        `<div class="ds spares"><b>${s.spares}</b><span>spares</span></div>` +
      `</div>`;
    return d;
  }
  function wrapCard(card) {
    const gc = document.createElement("div");
    gc.className = "group-card";
    if (card) gc.appendChild(card);
    return gc;
  }

  // -- Album --
  function passesFilter(num) {
    const s = getSt(num);
    if (filter === "missing") return !s.have;
    if (filter === "dupes") return s.dupes > 0;
    return true;
  }

  // A compact number cell (Figuritas-style). Shows just the sticker number;
  // colour shows state: missing / owned / owned+spares. Tap toggles owned,
  // long-press cycles the number of spares (0→1→2→3→4→0).
  function stickerEl(st, highlight) {
    const s = getSt(st.num);
    const el = document.createElement("div");
    el.className = "cell " + (s.have ? (s.dupes > 0 ? "owned dupe" : "owned") : "missing") +
      (highlight ? " highlight" : "");
    const parts = st.num.split(" ");
    const prefix = parts.length > 1 ? parts[0] : "";
    const numTxt = parts[parts.length - 1];
    el.innerHTML = (prefix ? `<span class="cp">${prefix}</span>` : "") +
      `<span class="cn">${numTxt}</span>` +
      (s.dupes > 0 ? `<span class="cd">${s.dupes}</span>` : "");
    if (editUnlocked) attachCellHandlers(el, st.num);
    return el;
  }

  function attachCellHandlers(el, num) {
    const startPress = () => {
      clearTimeout(pressTimer);
      pressTimer = setTimeout(() => { suppressClickUntil = Date.now() + 700; cycleSpare(num); }, 450);
    };
    const endPress = () => clearTimeout(pressTimer);
    el.addEventListener("click", () => {
      if (Date.now() < suppressClickUntil) return; // ignore the tap that follows a long-press
      toggleOwned(num);
    });
    el.addEventListener("touchstart", startPress, { passive: true });
    el.addEventListener("touchend", endPress);
    el.addEventListener("touchmove", endPress);
    el.addEventListener("touchcancel", endPress);
    el.addEventListener("mousedown", startPress);
    el.addEventListener("mouseup", endPress);
    el.addEventListener("mouseleave", endPress);
    el.addEventListener("contextmenu", (e) => e.preventDefault());
  }
  function toggleOwned(num) {
    const c = getSt(num);
    state[num] = c.have ? { have: false, dupes: 0 } : { have: true, dupes: 0 };
    saveState(); render();
  }
  function cycleSpare(num) {
    const c = getSt(num);
    const d = ((c.dupes || 0) + 1) % 5;
    state[num] = { have: true, dupes: d };
    saveState(); render();
    toast(d ? "Spare ×" + d : "Spares cleared");
  }

  function countryCard(team, opts) {
    opts = opts || {};
    const all = team.stickers || [];
    const total = all.length;
    const have = all.filter((st) => getSt(st.num).have).length;
    const pct = total ? Math.round((have / total) * 100) : 0;
    const id = (team.group || "") + "|" + team.name;

    // Which stickers to show.
    let list = all;
    if (opts.filterFn) list = all.filter(opts.filterFn);
    if (!list.length && !opts.alwaysShow) return null;

    // Collapsed unless: searched (alwaysShow), a filter expanded it, or the
    // user opened it (remembered across re-renders so taps don't close it).
    const collapsed = !opts.alwaysShow && opts.collapsed && !expandedTeams.has(id);

    const card = document.createElement("div");
    card.className = "country" + (collapsed ? " collapsed" : "");

    const head = document.createElement("div");
    head.className = "country-head";
    head.innerHTML =
      `<span class="flag">${team.flag || flagEmoji(team.code)}</span>` +
      `<span class="country-name">${team.name}</span>` +
      `<span class="country-count">${have}/${total}</span>` +
      `<span class="mini-bar"><span class="mini-fill" style="width:${pct}%"></span></span>` +
      `<span class="caret">▼</span>`;
    head.addEventListener("click", () => {
      card.classList.toggle("collapsed");
      if (card.classList.contains("collapsed")) expandedTeams.delete(id);
      else expandedTeams.add(id);
    });
    card.appendChild(head);

    const grid = document.createElement("div");
    grid.className = "stickers";
    if (!total) {
      grid.innerHTML = `<div class="empty-note" style="grid-column:1/-1">No stickers yet.</div>`;
    } else {
      list.forEach((st) => grid.appendChild(stickerEl(st, opts.highlight === st.num)));
    }
    card.appendChild(grid);
    return card;
  }

  function teamWithFlag(t, gid) {
    return { name: t.name, code: t.code, flag: t.flag || flagEmoji(t.code), stickers: t.stickers, group: gid };
  }

  function renderAlbum() {
    elMain.innerHTML = "";
    elMain.appendChild(buildDashboard());
    const res = resolveSearch(query);

    // Search banner for an exact code.
    if (res.type === "sticker") {
      const have = getSt(res.entry.num).have;
      elSearchResult.className = "search-result " + (have ? "sr-have" : "sr-missing");
      elSearchResult.innerHTML =
        `<span class="flag">${res.entry.flag || "🏳️"}</span>` +
        `<span class="sr-code">${res.entry.num}</span>` +
        `<span class="sr-country">· ${res.entry.country}</span>` +
        `<span class="sr-status">${have ? "✓ You have it" : "✕ Missing"}</span>`;
      elSearchResult.classList.remove("hidden");
    } else {
      elSearchResult.classList.add("hidden");
    }

    // Specific code -> just that country (expanded), highlighted.
    if (res.type === "sticker") {
      const c = COUNTRIES.find((x) => x.name === res.entry.country);
      if (c) elMain.appendChild(wrapCard(countryCard(teamWithFlag(c.team, c.group), { alwaysShow: true, highlight: res.entry.num })));
      buildNav();
      return;
    }
    // Country -> just that country, expanded.
    if (res.type === "country") {
      const c = res.country;
      elMain.appendChild(wrapCard(countryCard(teamWithFlag(c.team, c.group), { alwaysShow: true })));
      buildNav();
      return;
    }

    // Grouped overview. Rows collapse when showing everything; expand when a
    // filter is active so the matching numbers are visible.
    const ql = res.type === "filter" ? res.q : "";
    const collapsed = filter === "all" && !ql;
    const filterFn = (st) => {
      if (!passesFilter(st.num)) return false;
      if (!ql) return true;
      return norm(st.num).includes(norm(ql)) || (st.name || "").toLowerCase().includes(ql);
    };

    let any = false;
    (ALBUM.groups || []).forEach((g) => {
      const cards = (g.teams || [])
        .map((t) => countryCard(teamWithFlag(t, g.id), { filterFn, collapsed }))
        .filter(Boolean);
      if (!cards.length) return;
      any = true;
      const wrap = document.createElement("div");
      wrap.className = "group";
      wrap.id = "group-" + g.id;
      wrap.innerHTML = `<div class="group-title">${g.label || "Group " + g.id}</div>`;
      const gc = document.createElement("div");
      gc.className = "group-card";
      cards.forEach((c) => gc.appendChild(c));
      wrap.appendChild(gc);
      elMain.appendChild(wrap);
    });

    if (!any) {
      const note = document.createElement("div");
      note.className = "empty-note";
      note.textContent = "No stickers match this search/filter.";
      elMain.appendChild(note);
    }
    buildNav();
  }

  function buildNav() {
    elNav.innerHTML = "";
    if (query) return; // hide jump-nav while searching
    (ALBUM.groups || []).forEach((g) => {
      if (!(g.teams || []).some((t) => (t.stickers || []).length)) return;
      const a = document.createElement("a");
      a.href = "#group-" + g.id;
      a.textContent = g.id;
      elNav.appendChild(a);
    });
  }

  // -- Trade --
  function renderTrade() {
    elMain.innerHTML = "";
    const need = [], spares = [];
    ALL.forEach((s) => {
      const st = getSt(s.num);
      if (!st.have) need.push(label(s));
      if (st.dupes > 0) spares.push(`${s.num} ×${st.dupes} — ${s.country}`);
    });
    elMain.appendChild(panel("🔎", `Stickers I need (${need.length})`,
      need.length ? need.join("\n") : "Nothing missing — album complete! 🎉", need.join("\n")));
    elMain.appendChild(panel("🔁", `My spares to trade (${spares.length})`,
      spares.length ? spares.join("\n") : "No duplicates yet. Tap a sticker, then + to log a spare.", spares.join("\n")));
  }
  function label(s) { return `${s.num} — ${s.country}`; }

  function panel(icon, title, text, copyText) {
    const el = document.createElement("div");
    el.className = "panel";
    const empty = !copyText;
    el.innerHTML =
      `<h2>${icon} ${title}</h2>` +
      `<div class="list-box${empty ? " empty" : ""}">${text}</div>` +
      (empty ? "" : `<button class="btn btn-secondary copy-btn">Copy list</button>`);
    if (!empty) el.querySelector(".copy-btn").addEventListener("click", () =>
      navigator.clipboard.writeText(copyText).then(() => toast("Copied")));
    return el;
  }

  // -- Compare --
  let compareText = "";
  function renderCompare() {
    elMain.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "panel";
    wrap.innerHTML =
      `<h2>🤝 Compare a friend's list</h2>` +
      `<p class="hint">Paste your friend's sticker codes (any format — “mex12”, “MEX 12”, commas or new lines). ` +
      `It compares against the collection in this app. Nothing they do here changes your album.</p>` +
      `<div class="mini-seg">` +
        `<button data-mode="have" class="${compareMode === "have" ? "active" : ""}">They HAVE these</button>` +
        `<button data-mode="need" class="${compareMode === "need" ? "active" : ""}">They NEED these</button>` +
      `</div>` +
      `<textarea class="paste" placeholder="e.g. MEX 12, KOR 1, BRA 5, CZE 2 …">${compareText}</textarea>` +
      `<button class="btn btn-primary" id="cmpRun">Compare</button>` +
      `<div id="cmpOut"></div>`;
    elMain.appendChild(wrap);

    wrap.querySelectorAll(".mini-seg button").forEach((b) =>
      b.addEventListener("click", () => { compareMode = b.dataset.mode; renderCompare(); runCompare(); }));
    const ta = wrap.querySelector(".paste");
    ta.addEventListener("input", () => { compareText = ta.value; });
    wrap.querySelector("#cmpRun").addEventListener("click", runCompare);
    if (compareText.trim()) runCompare();
  }

  function parseList(text) {
    const found = new Set();
    const re = /[A-Z]{2,4}\s?-?\s?\d{1,3}/gi;
    (text.toUpperCase().match(re) || []).forEach((tok) => {
      const e = BY_CODE[norm(tok)];
      if (e) found.add(e.num);
    });
    return found;
  }

  function runCompare() {
    const out = document.getElementById("cmpOut");
    if (!out) return;
    const friendSet = parseList(compareText);
    if (!friendSet.size) {
      out.innerHTML = `<p class="hint" style="margin-top:14px">No recognizable sticker codes found yet.</p>`;
      return;
    }
    const friendHas = (num) => compareMode === "have" ? friendSet.has(num) : !friendSet.has(num);
    const youHave = (num) => getSt(num).have;

    const canGet = [], canGive = [];
    ALL.forEach((s) => {
      if (friendHas(s.num) && !youHave(s.num)) canGet.push(s);
      if (youHave(s.num) && !friendHas(s.num)) canGive.push(s);
    });

    const getText = canGet.map(label).join("\n");
    const giveText = canGive.map(label).join("\n");

    out.innerHTML =
      `<div class="tally">` +
        `<div class="tcard get"><div class="tnum">${canGet.length}</div><div class="tlbl">you can get</div></div>` +
        `<div class="tcard give"><div class="tnum">${canGive.length}</div><div class="tlbl">you can give</div></div>` +
      `</div>` +
      `<div class="panel" style="margin-top:0;box-shadow:none;padding:0">` +
        block("⬇️", `They have, you're missing (${canGet.length})`, getText, "get") +
        block("⬆️", `You have, they're missing (${canGive.length})`, giveText, "give") +
      `</div>`;

    bindCopy(out, "get", getText);
    bindCopy(out, "give", giveText);
  }
  function block(icon, title, text, key) {
    const empty = !text;
    return `<h2 style="margin-top:16px">${icon} ${title}</h2>` +
      `<div class="list-box${empty ? " empty" : ""}">${empty ? "Nothing here." : text}</div>` +
      (empty ? "" : `<button class="btn btn-secondary copy-btn" data-copy="${key}">Copy list</button>`);
  }
  function bindCopy(root, key, text) {
    const b = root.querySelector(`[data-copy="${key}"]`);
    if (b) b.addEventListener("click", () => navigator.clipboard.writeText(text).then(() => toast("Copied")));
  }

  // ---- Toast ---------------------------------------------------------------
  let toastTimer;
  function toast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 1500);
  }

  // ---- Backup / Restore / Reset -------------------------------------------
  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "wc2026-stickers-backup.json"; a.click();
    URL.revokeObjectURL(url);
    toast("Backup downloaded");
  }
  function importData(file) {
    const r = new FileReader();
    r.onload = () => {
      try { state = JSON.parse(r.result) || {}; saveState(); render(); toast("Backup restored"); }
      catch { toast("Couldn't read that file"); }
    };
    r.readAsText(file);
  }
  function resetData() {
    if (confirm("Reset all your Have/Missing/duplicate marks? This can't be undone.")) {
      state = {}; saveState(); render(); toast("Tracker reset");
    }
  }

  // ---- Edit lock -----------------------------------------------------------
  async function sha256(str) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  function applyLockUI() {
    document.body.classList.toggle("locked", !editUnlocked);
    document.getElementById("ownerTools").classList.toggle("hidden", !editUnlocked);
    // Unlock entry shows only when locked (and not in personal mode).
    document.getElementById("unlockBtn").classList.toggle("hidden", editUnlocked || personalMode);
    // Lock entry shows only when currently unlocked (and not personal).
    document.getElementById("lockBtn").classList.toggle("hidden", !editUnlocked || personalMode);
  }
  async function unlock() {
    const pw = prompt("Enter the edit password:");
    if (pw == null) return;
    const ok = EDIT_HASH && (await sha256(pw)) === EDIT_HASH;
    if (ok) {
      editUnlocked = true;
      localStorage.setItem(UNLOCK_KEY, "1");
      applyLockUI(); render(); closeSheet(); toast("Editing unlocked");
    } else {
      toast("Wrong password");
    }
  }
  function lock() {
    editUnlocked = false;
    localStorage.removeItem(UNLOCK_KEY);
    applyLockUI(); render(); closeSheet(); toast("Locked — view only");
  }

  // ---- Share / personal mode ----------------------------------------------
  function appUrl() { return location.origin + location.pathname; }

  async function shareApp() {
    const url = appUrl();
    const text = "Check out my World Cup 2026 Panini sticker collection — see what I've got and compare yours to find trades ⚽";
    closeSheet();
    if (navigator.share) {
      try { await navigator.share({ title: "WC2026 Sticker Tracker", text, url }); }
      catch (e) { /* user cancelled */ }
    } else {
      try { await navigator.clipboard.writeText(text + " " + url); toast("Link copied"); }
      catch (e) { toast(url); }
    }
  }

  function copyMyList() {
    const haves = ALL.filter((s) => getSt(s.num).have).map((s) => s.num);
    closeSheet();
    if (!haves.length) { toast("No stickers marked yet"); return; }
    navigator.clipboard.writeText(haves.join(", "))
      .then(() => toast(`Copied your ${haves.length} stickers`));
  }

  function startPersonal() {
    closeSheet();
    if (personalMode) { toast("You're already on your own album"); return; }
    if (confirm("Start your OWN blank album on this device?\n\nYou'll track your own stickers and can switch back to the shared view anytime.")) {
      localStorage.setItem(PERSONAL_KEY, "1");
      location.reload();
    }
  }
  function exitPersonal() {
    localStorage.removeItem(PERSONAL_KEY);
    location.reload();
  }

  function openSheet() { document.getElementById("sheet").classList.remove("hidden"); }
  function closeSheet() { document.getElementById("sheet").classList.add("hidden"); }

  function updateModeBanner() {
    const b = document.getElementById("modeBanner");
    if (personalMode) {
      b.className = "mode-banner";
      b.innerHTML = `✨ Your own album · <button class="link" id="exitMine">switch to shared view</button>`;
      b.querySelector("#exitMine").addEventListener("click", exitPersonal);
    } else {
      b.className = "mode-banner hidden";
      b.innerHTML = "";
    }
  }

  // ---- Init ----------------------------------------------------------------
  function setThumb(index) {
    const thumb = document.querySelector(".seg-thumb");
    if (thumb) thumb.style.transform = `translateX(${index * 100}%)`;
  }
  function syncSeg() {
    const views = ["album", "trade", "compare"];
    document.querySelectorAll(".seg").forEach((s) =>
      s.classList.toggle("active", s.dataset.view === view));
    setThumb(views.indexOf(view));
  }

  function init() {
    buildIndexes();

    const searchEl = document.getElementById("search");
    const searchWrap = document.querySelector(".search-wrap");
    searchEl.addEventListener("input", (e) => {
      query = e.target.value;
      searchWrap.classList.toggle("has-text", !!query);
      if (query && view !== "album") { view = "album"; syncSeg(); }
      render();
    });
    document.getElementById("searchClear").addEventListener("click", () => {
      query = ""; searchEl.value = ""; searchWrap.classList.remove("has-text"); searchEl.focus(); render();
    });

    document.querySelectorAll(".chip-btn").forEach((b) =>
      b.addEventListener("click", () => {
        document.querySelectorAll(".chip-btn").forEach((x) => x.classList.remove("active"));
        b.classList.add("active"); filter = b.dataset.filter; renderAlbum();
      }));

    document.querySelectorAll(".seg").forEach((s) =>
      s.addEventListener("click", () => { view = s.dataset.view; syncSeg(); render(); }));

    document.getElementById("exportBtn").addEventListener("click", exportData);
    document.getElementById("resetBtn").addEventListener("click", resetData);
    document.getElementById("importInput").addEventListener("change", (e) => {
      if (e.target.files[0]) importData(e.target.files[0]);
      e.target.value = "";
    });
    document.getElementById("unlockBtn").addEventListener("click", unlock);
    document.getElementById("lockBtn").addEventListener("click", lock);

    // Share sheet + personal mode
    document.getElementById("shareBtn").addEventListener("click", openSheet);
    document.getElementById("sheetClose").addEventListener("click", closeSheet);
    document.querySelector("#sheet .sheet-backdrop").addEventListener("click", closeSheet);
    document.getElementById("shareLink").addEventListener("click", shareApp);
    document.getElementById("copyList").addEventListener("click", copyMyList);
    document.getElementById("startMine").addEventListener("click", startPersonal);

    updateModeBanner();
    applyLockUI();
    syncSeg();
    render();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
