/*
 * World Cup 2026 Panini sticker tracker — app logic.
 *
 * State model: for each sticker `num` we store { have: bool, dupes: int }.
 * Default (not in store) = missing. Saved to localStorage so it persists on
 * the device. The album definition lives in data.js (window.ALBUM).
 */

(function () {
  "use strict";

  const STORE_KEY = "wc2026-stickers-v1";
  const ALBUM = window.ALBUM;

  // ---- State ---------------------------------------------------------------
  /** @type {Record<string, {have:boolean, dupes:number}>} */
  let state = applySeed(loadState());
  let filter = "all";   // all | missing | dupes
  let query = "";
  let view = "album";   // album | trade

  function loadState() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY)) || {};
    } catch {
      return {};
    }
  }
  function saveState() {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  }
  function getSt(num) {
    return state[num] || { have: false, dupes: 0 };
  }

  // First-run helper: pre-fill Have/Missing read from the album photos
  // (window.SEED). Only fills stickers the user hasn't touched yet, so it
  // never overwrites your own marks and new groups get seeded as they're added.
  function applySeed(st) {
    const seed = (typeof window !== "undefined" && window.SEED) || {};
    let changed = false;
    for (const num in seed) {
      if (!(num in st)) {
        st[num] = seed[num];
        changed = true;
      }
    }
    if (changed) localStorage.setItem(STORE_KEY, JSON.stringify(st));
    return st;
  }

  // ---- Album helpers -------------------------------------------------------
  // Flatten every sticker once, with its group/country context, for counting
  // and search.
  function allStickers() {
    const out = [];
    (ALBUM.sections || []).forEach((s) =>
      (s.stickers || []).forEach((st) =>
        out.push({ ...st, ctx: s.name, group: "•" })
      )
    );
    (ALBUM.groups || []).forEach((g) =>
      (g.teams || []).forEach((t) =>
        (t.stickers || []).forEach((st) =>
          out.push({ ...st, ctx: t.name, group: g.id })
        )
      )
    );
    return out;
  }

  function flagEmoji(code) {
    if (!code || code.length !== 2 || code === "TB") return "🏳️";
    const A = 0x1f1e6;
    const up = code.toUpperCase();
    return String.fromCodePoint(
      A + up.charCodeAt(0) - 65,
      A + up.charCodeAt(1) - 65
    );
  }

  function matchesQuery(st, name) {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      String(st.num).toLowerCase().includes(q) ||
      (st.name || "").toLowerCase().includes(q) ||
      (name || "").toLowerCase().includes(q)
    );
  }

  function passesFilter(num) {
    const s = getSt(num);
    if (filter === "missing") return !s.have;
    if (filter === "dupes") return s.dupes > 0;
    return true;
  }

  // ---- Rendering -----------------------------------------------------------
  const elMain = document.getElementById("main");
  const elNav = document.getElementById("groupNav");

  function render() {
    updateProgress();
    if (view === "trade") {
      elNav.classList.add("hidden");
      renderTrade();
    } else {
      elNav.classList.remove("hidden");
      renderAlbum();
    }
  }

  function updateProgress() {
    const all = allStickers();
    const total = all.length;
    const have = all.filter((s) => getSt(s.num).have).length;
    const pct = total ? Math.round((have / total) * 100) : 0;
    document.getElementById("progressFill").style.width = pct + "%";
    document.getElementById("progressLabel").innerHTML =
      `<span>${have} / ${total} collected</span><span>${pct}%</span>`;
  }

  function stickerEl(st, ownerName) {
    const s = getSt(st.num);
    const el = document.createElement("div");
    el.className = "sticker" + (s.have ? (s.dupes > 0 ? " have dupe" : " have") : "");
    el.dataset.num = st.num;

    let html =
      `<div class="num">${st.num}</div>` +
      `<div class="nm">${st.name || ""}</div>`;
    if (s.dupes > 0) html += `<div class="dupe-badge">+${s.dupes}</div>`;
    html +=
      `<div class="stepper">` +
      `<button data-act="minus" aria-label="one fewer spare">−</button>` +
      `<button data-act="plus" aria-label="one more spare">+</button>` +
      `</div>`;
    el.innerHTML = html;

    el.addEventListener("click", (e) => {
      const act = e.target.dataset && e.target.dataset.act;
      if (act === "plus") {
        e.stopPropagation();
        const cur = getSt(st.num);
        state[st.num] = { have: true, dupes: cur.dupes + 1 };
      } else if (act === "minus") {
        e.stopPropagation();
        const cur = getSt(st.num);
        state[st.num] = { have: true, dupes: Math.max(0, cur.dupes - 1) };
      } else {
        // Toggle have <-> missing. Going missing clears dupes.
        const cur = getSt(st.num);
        state[st.num] = cur.have ? { have: false, dupes: 0 } : { have: true, dupes: 0 };
      }
      saveState();
      render();
    });
    return el;
  }

  function countryCard(team, groupId) {
    const visible = (team.stickers || []).filter(
      (st) => passesFilter(st.num) && matchesQuery(st, team.name)
    );
    if (!visible.length && (query || filter !== "all")) return null;

    const total = (team.stickers || []).length;
    const have = (team.stickers || []).filter((st) => getSt(st.num).have).length;
    const pct = total ? Math.round((have / total) * 100) : 0;

    const card = document.createElement("div");
    card.className = "country";

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
      grid.innerHTML = `<div class="empty-note" style="grid-column:1/-1">No stickers added yet — coming from album photos.</div>`;
    } else {
      visible.forEach((st) => grid.appendChild(stickerEl(st, team.name)));
    }
    card.appendChild(grid);
    return card;
  }

  function renderAlbum() {
    elMain.innerHTML = "";

    // Non-team sections first.
    (ALBUM.sections || []).forEach((sec) => {
      if (!(sec.stickers || []).length) return;
      const team = { code: "", name: `${sec.icon || ""} ${sec.name}`, stickers: sec.stickers };
      const wrap = document.createElement("div");
      wrap.className = "group";
      wrap.id = "sec-" + sec.id;
      const card = countryCard(team, "•");
      if (card) wrap.appendChild(card);
      if (wrap.children.length) elMain.appendChild(wrap);
    });

    // Groups A–L.
    (ALBUM.groups || []).forEach((g) => {
      const cards = (g.teams || [])
        .map((t) => countryCard(t, g.id))
        .filter(Boolean);
      if (!cards.length) return;

      const wrap = document.createElement("div");
      wrap.className = "group";
      wrap.id = "group-" + g.id;
      const h = document.createElement("h2");
      h.className = "group-title";
      h.textContent = "Group " + g.id;
      wrap.appendChild(h);
      cards.forEach((c) => wrap.appendChild(c));
      elMain.appendChild(wrap);
    });

    if (!elMain.children.length) {
      elMain.innerHTML =
        `<div class="empty-note">Nothing to show for this filter/search.<br>` +
        `Add album photos in chat and the stickers will appear here.</div>`;
    }

    buildNav();
  }

  function buildNav() {
    elNav.innerHTML = "";
    (ALBUM.groups || []).forEach((g) => {
      if (!(g.teams || []).some((t) => (t.stickers || []).length)) return;
      const a = document.createElement("a");
      a.href = "#group-" + g.id;
      a.textContent = g.id;
      elNav.appendChild(a);
    });
  }

  function renderTrade() {
    elMain.innerHTML = "";

    const need = [];
    const spares = [];
    allStickers().forEach((s) => {
      const st = getSt(s.num);
      if (!st.have) need.push(`${s.num} ${s.name ? "(" + s.name + ")" : ""} — ${s.ctx}`);
      if (st.dupes > 0) spares.push(`${s.num} x${st.dupes} ${s.name ? "(" + s.name + ")" : ""} — ${s.ctx}`);
    });

    elMain.appendChild(tradeBlock("🔎", `Stickers I need (${need.length})`,
      need.length ? need.join("\n") : "Nothing missing — album complete! 🎉", "need"));
    elMain.appendChild(tradeBlock("🔁", `My spares to trade (${spares.length})`,
      spares.length ? spares.join("\n") : "No duplicates yet.", "spares"));
  }

  function tradeBlock(icon, title, text, key) {
    const block = document.createElement("div");
    block.className = "trade-block";
    block.innerHTML =
      `<h2>${icon} ${title}</h2>` +
      `<div class="trade-list" id="list-${key}">${text}</div>` +
      `<button class="copy-btn" data-copy="${key}">Copy list</button>`;
    block.querySelector(".copy-btn").addEventListener("click", () => {
      navigator.clipboard.writeText(text).then(() => toast("Copied to clipboard"));
    });
    return block;
  }

  // ---- Toast ---------------------------------------------------------------
  let toastTimer;
  function toast(msg) {
    let t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 1600);
  }

  // ---- Export / Import / Reset --------------------------------------------
  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "wc2026-stickers-backup.json";
    a.click();
    URL.revokeObjectURL(url);
    toast("Backup downloaded");
  }
  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        state = JSON.parse(reader.result) || {};
        saveState();
        render();
        toast("Backup restored");
      } catch {
        toast("Couldn't read that file");
      }
    };
    reader.readAsText(file);
  }
  function resetData() {
    if (confirm("Reset all your Have/Missing/duplicate marks? This can't be undone.")) {
      state = {};
      saveState();
      render();
      toast("Tracker reset");
    }
  }

  // ---- Wire up controls ----------------------------------------------------
  function init() {
    document.getElementById("appTitle").textContent = ALBUM.meta.title;

    document.getElementById("search").addEventListener("input", (e) => {
      query = e.target.value.trim();
      if (view !== "album") { view = "album"; syncTabs(); }
      renderAlbum();
    });

    document.querySelectorAll(".filters .chip-btn").forEach((b) => {
      b.addEventListener("click", () => {
        document.querySelectorAll(".filters .chip-btn").forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        filter = b.dataset.filter;
        renderAlbum();
      });
    });

    document.querySelectorAll(".tab").forEach((t) => {
      t.addEventListener("click", () => {
        view = t.dataset.view;
        syncTabs();
        render();
      });
    });

    document.getElementById("exportBtn").addEventListener("click", exportData);
    document.getElementById("resetBtn").addEventListener("click", resetData);
    document.getElementById("importInput").addEventListener("change", (e) => {
      if (e.target.files[0]) importData(e.target.files[0]);
      e.target.value = "";
    });

    render();
  }

  function syncTabs() {
    document.querySelectorAll(".tab").forEach((t) =>
      t.classList.toggle("active", t.dataset.view === view)
    );
  }

  document.addEventListener("DOMContentLoaded", init);
})();
