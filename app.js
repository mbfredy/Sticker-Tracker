/*
 * World Cup 2026 Panini sticker tracker — app logic.
 *
 * State: per sticker `num` -> { have:bool, dupes:int }. Default = missing.
 * Saved to localStorage. Album definition is in data.js; the pre-filled
 * collection read from photos is in seed.js (window.SEED).
 */

(function () {
  "use strict";

  const STORE_KEY = "wc2026-stickers-v1";
  const ALBUM = window.ALBUM;

  // ---- State ---------------------------------------------------------------
  let state = applySeed(loadState());
  let filter = "all";       // all | missing | dupes
  let query = "";
  let view = "album";       // album | trade | compare
  let compareMode = "have"; // friend's pasted list is what they HAVE or NEED

  function loadState() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
    catch { return {}; }
  }
  function saveState() { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
  function getSt(num) { return state[num] || { have: false, dupes: 0 }; }

  // First-run: pre-fill from photos, only for stickers not yet touched.
  function applySeed(st) {
    const seed = window.SEED || {};
    let changed = false;
    for (const num in seed) {
      if (!(num in st)) { st[num] = seed[num]; changed = true; }
    }
    if (changed) localStorage.setItem(STORE_KEY, JSON.stringify(st));
    return st;
  }

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
    updateProgress();
    elNav.classList.toggle("hidden", view !== "album");
    elFilters.classList.toggle("hidden", view !== "album");
    if (view === "trade") { elSearchResult.classList.add("hidden"); renderTrade(); }
    else if (view === "compare") { elSearchResult.classList.add("hidden"); renderCompare(); }
    else renderAlbum();
  }

  function updateProgress() {
    const total = ALL.length;
    const have = ALL.filter((s) => getSt(s.num).have).length;
    const pct = total ? Math.round((have / total) * 100) : 0;
    document.getElementById("progressFill").style.width = pct + "%";
    document.getElementById("progressLabel").innerHTML =
      `<span>${have} of ${total} collected</span><span>${pct}%</span>`;
  }

  // -- Album --
  function passesFilter(num) {
    const s = getSt(num);
    if (filter === "missing") return !s.have;
    if (filter === "dupes") return s.dupes > 0;
    return true;
  }

  function stickerEl(st, highlight) {
    const s = getSt(st.num);
    const el = document.createElement("div");
    el.className = "sticker" + (s.have ? " have" : "") + (highlight ? " highlight" : "");
    let html = `<div class="num">${st.num}</div><div class="nm">${st.name || ""}</div>`;
    if (s.dupes > 0) html += `<div class="dupe-badge">+${s.dupes}</div>`;
    html += `<div class="stepper"><button data-act="minus">−</button><button data-act="plus">+</button></div>`;
    el.innerHTML = html;
    el.addEventListener("click", (e) => {
      const act = e.target.dataset && e.target.dataset.act;
      const cur = getSt(st.num);
      if (act === "plus") { e.stopPropagation(); state[st.num] = { have: true, dupes: cur.dupes + 1 }; }
      else if (act === "minus") { e.stopPropagation(); state[st.num] = { have: true, dupes: Math.max(0, cur.dupes - 1) }; }
      else { state[st.num] = cur.have ? { have: false, dupes: 0 } : { have: true, dupes: 0 }; }
      saveState();
      render();
    });
    return el;
  }

  function countryCard(team, opts) {
    opts = opts || {};
    const all = team.stickers || [];
    const total = all.length;
    const have = all.filter((st) => getSt(st.num).have).length;
    const pct = total ? Math.round((have / total) * 100) : 0;

    // Which stickers to show.
    let list = all;
    if (opts.filterFn) list = all.filter(opts.filterFn);
    if (!list.length && !opts.alwaysShow) return null;

    const card = document.createElement("div");
    card.className = "country" + (opts.collapsed ? " collapsed" : "");

    const head = document.createElement("div");
    head.className = "country-head";
    head.innerHTML =
      `<span class="flag">${team.flag || flagEmoji(team.code)}</span>` +
      `<span class="country-name">${team.name}</span>` +
      `<span class="country-count">${have}/${total}</span>` +
      `<span class="mini-bar"><span class="mini-fill" style="width:${pct}%"></span></span>` +
      `<span class="caret">▼</span>`;
    head.addEventListener("click", () => card.classList.toggle("collapsed"));
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

    // Specific code -> just that country, full list, highlighted.
    if (res.type === "sticker") {
      const c = COUNTRIES.find((x) => x.name === res.entry.country);
      if (c) elMain.appendChild(countryCard(teamWithFlag(c.team, c.group), { alwaysShow: true, highlight: res.entry.num }));
      return;
    }
    // Country -> just that country, full list.
    if (res.type === "country") {
      const c = res.country;
      elMain.appendChild(countryCard(teamWithFlag(c.team, c.group), { alwaysShow: true }));
      return;
    }

    // Generic filter / no query -> grouped view.
    const ql = res.type === "filter" ? res.q : "";
    const filterFn = (st) => {
      if (!passesFilter(st.num)) return false;
      if (!ql) return true;
      return norm(st.num).includes(norm(ql)) || (st.name || "").toLowerCase().includes(ql);
    };

    (ALBUM.groups || []).forEach((g) => {
      const cards = (g.teams || [])
        .map((t) => countryCard(teamWithFlag(t, g.id), { filterFn }))
        .filter(Boolean);
      if (!cards.length) return;
      const wrap = document.createElement("div");
      wrap.className = "group";
      wrap.id = "group-" + g.id;
      wrap.innerHTML = `<div class="group-title">Group ${g.id}</div>`;
      cards.forEach((c) => wrap.appendChild(c));
      elMain.appendChild(wrap);
    });

    if (!elMain.children.length) {
      elMain.innerHTML = `<div class="empty-note">No stickers match this search/filter.</div>`;
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

    syncSeg();
    render();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
