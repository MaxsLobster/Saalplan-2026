import { STAND_LAYOUT, COLS, ROWS, validateLayout } from "./layout.js";
import {
  BASE_ID,
  STANDPLAN_TABLE,
  AUSSTELLER_TABLE,
  FIELDS,
  listAllRecords,
  updateStandplanRecord,
  createAussteller,
  validateToken,
} from "./airtable.js";

// === Konstanten ===
const CELL_W = 40;
const CELL_H = 26;
const PLAN_W = COLS * CELL_W;
const PLAN_H = ROWS * CELL_H;
const SYNC_INTERVAL_MS = 30_000;
const TOKEN_KEY = "saalplan_token_v1";
const QUEUE_KEY = "saalplan_queue_v1";

// === App-State ===
const state = {
  token: null,
  standsByNr: new Map(),       // standNr -> { recordId, status, ausstellerIds, notes, bezahlt }
  ausstellerById: new Map(),    // recordId -> { firmenname, notizen }
  ausstellerByName: new Map(),  // firmenname (lowercase) -> recordId
  syncTimer: null,
  lastSyncTime: null,
  syncError: null,
  searchHighlight: new Set(),   // Set of standNr strings
  selectedStandNr: null,
};

// === DOM-Referenzen ===
const $ = (id) => document.getElementById(id);

// === Status-Automatik ===
// Status-VORSCHLAG aus (Aussteller, Bezahlt) — kann im Modal-Dropdown
// manuell überschrieben werden:
//   kein Aussteller          → frei
//   Aussteller + bezahlt     → besetzt
//   Aussteller + nicht bezahlt → reserviert
function computeStatus(hasAussteller, bezahlt) {
  if (!hasAussteller) return "frei";
  return bezahlt ? "besetzt" : "reserviert";
}

// Markiert, ob der User den Status-Dropdown im aktuellen Modal manuell
// geändert hat — dann werden keine Auto-Vorschläge mehr überschrieben.
let modalStatusManuallyChanged = false;

// === Token-Handling ===
function loadToken() {
  return localStorage.getItem(TOKEN_KEY);
}
function saveToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}
function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// === Offline-Queue ===
function loadQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY)) || [];
  } catch {
    return [];
  }
}
function saveQueue(queue) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}
function enqueueUpdate(update) {
  const queue = loadQueue();
  // Letzten Eintrag für denselben Record überschreiben (Coalescing)
  const idx = queue.findIndex((u) => u.recordId === update.recordId);
  if (idx >= 0) queue[idx] = update;
  else queue.push(update);
  saveQueue(queue);
}
async function flushQueue() {
  let queue = loadQueue();
  if (queue.length === 0) return;
  const remaining = [];
  for (const update of queue) {
    try {
      await updateStandplanRecord(state.token, update.recordId, update.fields);
    } catch (err) {
      console.error("Queue-Flush fehlgeschlagen:", err);
      remaining.push(update);
    }
  }
  saveQueue(remaining);
}

// === SVG-Plan rendern ===
function renderPlan() {
  const svg = $("plan");
  svg.setAttribute("viewBox", `0 0 ${PLAN_W} ${PLAN_H}`);
  // Feste Pixel-Größe, damit unsere Transform-Logik die einzige Skalierung ist
  svg.style.width = PLAN_W + "px";
  svg.style.height = PLAN_H + "px";
  svg.innerHTML = "";

  const NS = "http://www.w3.org/2000/svg";

  // Rahmen
  const frame = document.createElementNS(NS, "rect");
  frame.setAttribute("x", 0);
  frame.setAttribute("y", 0);
  frame.setAttribute("width", PLAN_W);
  frame.setAttribute("height", PLAN_H);
  frame.setAttribute("class", "plan-frame");
  svg.appendChild(frame);

  // EXIT / ENTRANCE Beschriftung — wie im PDF unten am Rand
  const exitText = document.createElementNS(NS, "text");
  exitText.setAttribute("x", 8 * CELL_W);
  exitText.setAttribute("y", (ROWS - 0.3) * CELL_H);
  exitText.setAttribute("text-anchor", "middle");
  exitText.setAttribute("class", "plan-label");
  exitText.textContent = "EXIT";
  svg.appendChild(exitText);

  const entranceText = document.createElementNS(NS, "text");
  entranceText.setAttribute("x", 17 * CELL_W);
  entranceText.setAttribute("y", (ROWS - 0.3) * CELL_H);
  entranceText.setAttribute("text-anchor", "middle");
  entranceText.setAttribute("class", "plan-label");
  entranceText.textContent = "ENTRANCE";
  svg.appendChild(entranceText);

  // Alle Stände rendern
  for (const [standNr, pos] of Object.entries(STAND_LAYOUT)) {
    const x = pos.col * CELL_W;
    const y = pos.row * CELL_H;

    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", "stand");
    g.dataset.standNr = standNr;
    g.setAttribute("transform", `translate(${x},${y})`);

    const rect = document.createElementNS(NS, "rect");
    rect.setAttribute("width", CELL_W - 1);
    rect.setAttribute("height", CELL_H - 1);
    rect.setAttribute("rx", 2);
    rect.setAttribute("class", "stand-rect");

    const txt = document.createElementNS(NS, "text");
    txt.setAttribute("x", (CELL_W - 1) / 2);
    txt.setAttribute("y", (CELL_H - 1) / 2 + 1);
    txt.setAttribute("text-anchor", "middle");
    txt.setAttribute("dominant-baseline", "middle");
    txt.setAttribute("class", "stand-nr");
    txt.textContent = standNr;

    const sub = document.createElementNS(NS, "text");
    sub.setAttribute("x", (CELL_W - 1) / 2);
    sub.setAttribute("y", CELL_H - 4);
    sub.setAttribute("text-anchor", "middle");
    sub.setAttribute("class", "stand-firma");
    sub.textContent = "";

    g.appendChild(rect);
    g.appendChild(txt);
    g.appendChild(sub);

    g.addEventListener("click", (e) => {
      e.stopPropagation();
      openModal(standNr);
    });

    svg.appendChild(g);
  }
}

// === Stand-Visualisierung updaten (Farbe + Firmenname) ===
function refreshStandsVisual() {
  for (const [standNr, info] of state.standsByNr) {
    const g = document.querySelector(`g.stand[data-stand-nr="${standNr}"]`);
    if (!g) continue;
    const rect = g.querySelector(".stand-rect");
    const sub = g.querySelector(".stand-firma");

    rect.setAttribute("data-status", info.status || "frei");

    // Firmenname (nur wenn besetzt/reserviert UND ein Aussteller verknüpft)
    const firstId = info.ausstellerIds?.[0];
    const firma = firstId ? state.ausstellerById.get(firstId)?.firmenname : "";
    if (firma) {
      const shortened = firma.length > 8 ? firma.slice(0, 7) + "…" : firma;
      sub.textContent = shortened;
      g.querySelector(".stand-nr").setAttribute("y", 9);
    } else {
      sub.textContent = "";
      g.querySelector(".stand-nr").setAttribute("y", (CELL_H - 1) / 2 + 1);
    }

    g.classList.toggle("bezahlt", !!info.bezahlt);
    g.classList.toggle("has-rechnung", !!info.reNr);
    g.classList.toggle("highlight", state.searchHighlight.has(String(standNr)));
    g.classList.toggle("selected", String(standNr) === String(state.selectedStandNr));
  }
}

// === Statistik aktualisieren ===
function refreshStats() {
  let frei = 0, besetzt = 0, reserviert = 0, rechnungOffen = 0;
  for (const info of state.standsByNr.values()) {
    if (info.status === "besetzt") {
      besetzt++;
      if (!info.reNr) rechnungOffen++;
    }
    else if (info.status === "reserviert") reserviert++;
    else frei++;
  }
  // Stände, die nicht in Airtable existieren, gelten als frei
  const layoutTotal = Object.keys(STAND_LAYOUT).length;
  const unmapped = layoutTotal - state.standsByNr.size;
  frei += unmapped;

  $("stats-besetzt").textContent = `${besetzt} besetzt`;
  $("stats-reserviert").textContent = `${reserviert} reserviert`;
  $("stats-frei").textContent = `${frei} frei`;
  $("stats-rechnung-offen").textContent = `${rechnungOffen} Re offen`;
  $("stats-total").textContent = `${besetzt + reserviert} / ${layoutTotal}`;
}

// === Sync mit Airtable ===
async function syncFromAirtable() {
  setSyncStatus("syncing");
  try {
    const [standRecords, ausstellerRecords] = await Promise.all([
      listAllRecords(state.token, STANDPLAN_TABLE),
      listAllRecords(state.token, AUSSTELLER_TABLE),
    ]);

    // Aussteller-Maps aufbauen
    state.ausstellerById.clear();
    state.ausstellerByName.clear();
    for (const r of ausstellerRecords) {
      const firmenname = r.fields[FIELDS.firmenname] || "";
      const notizen = r.fields[FIELDS.aussteller_notizen] || "";
      state.ausstellerById.set(r.id, { firmenname, notizen });
      if (firmenname) state.ausstellerByName.set(firmenname.toLowerCase(), r.id);
    }

    // Standplan-Map aufbauen
    state.standsByNr.clear();
    for (const r of standRecords) {
      const standNr = r.fields[FIELDS.standnummer];
      if (standNr == null) continue;
      state.standsByNr.set(String(standNr), {
        recordId: r.id,
        status: r.fields[FIELDS.status] || "frei",
        ausstellerIds: r.fields[FIELDS.aussteller] || [],
        notes: r.fields[FIELDS.notes] || "",
        bezahlt: !!r.fields[FIELDS.bezahlt],
        reNr: r.fields[FIELDS.re_nr] || "",
      });
    }

    refreshAusstellerDatalist();
    refreshStandsVisual();
    refreshStats();

    state.lastSyncTime = new Date();
    state.syncError = null;
    setSyncStatus("ok");
  } catch (err) {
    console.error("Sync fehlgeschlagen:", err);
    state.syncError = err.message;
    setSyncStatus("error");
  }
}

function setSyncStatus(status) {
  const indicator = $("sync-indicator");
  const text = $("sync-text");
  indicator.dataset.status = status;
  if (status === "syncing") {
    text.textContent = "synchronisiere …";
  } else if (status === "error") {
    text.textContent = `Fehler — klick für Details`;
  } else if (state.lastSyncTime) {
    const seconds = Math.round((Date.now() - state.lastSyncTime) / 1000);
    text.textContent = seconds < 5 ? "gerade synchronisiert" : `synchronisiert vor ${seconds}s`;
  } else {
    text.textContent = "—";
  }
}

// Sync-Status-Text einmal pro Sekunde aktualisieren
setInterval(() => {
  if ($("sync-indicator")?.dataset.status === "ok") setSyncStatus("ok");
}, 1000);

// === Aussteller-Datalist für Autocomplete ===
function refreshAusstellerDatalist() {
  const list = $("aussteller-list");
  list.innerHTML = "";
  const names = [...state.ausstellerById.values()]
    .map((a) => a.firmenname)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "de"));
  for (const name of names) {
    const opt = document.createElement("option");
    opt.value = name;
    list.appendChild(opt);
  }
}

// === Modal öffnen/schließen ===
function openModal(standNr) {
  state.selectedStandNr = standNr;
  refreshStandsVisual();

  const info = state.standsByNr.get(String(standNr)) || {
    recordId: null,
    status: "frei",
    ausstellerIds: [],
    notes: "",
    bezahlt: false,
    reNr: "",
  };

  $("modal-stand-nr").textContent = standNr;
  const firstId = info.ausstellerIds?.[0];
  $("modal-aussteller").value = firstId
    ? state.ausstellerById.get(firstId)?.firmenname || ""
    : "";
  $("modal-notes").value = info.notes || "";
  $("modal-bezahlt").checked = !!info.bezahlt;
  $("modal-re-nr").value = info.reNr || "";
  $("modal-error").textContent = "";

  // Status-Dropdown initial setzen.
  // Wenn Airtable-Status inkonsistent zum Aussteller (z.B. "frei" trotz Name)
  // → automatisch korrigieren, User muss nur noch Speichern klicken.
  modalStatusManuallyChanged = false;
  const hasAussteller = !!firstId;
  const autoStatus = computeStatus(hasAussteller, !!info.bezahlt);
  const airtableStatus = info.status || "frei";
  const inconsistent =
    (hasAussteller && airtableStatus === "frei") ||
    (!hasAussteller && airtableStatus !== "frei");
  $("modal-status").value = inconsistent ? autoStatus : airtableStatus;

  if (!info.recordId) {
    $("modal-error").textContent =
      "Hinweis: Dieser Stand ist noch nicht in Airtable angelegt. Bitte zuerst in Airtable hinzufügen.";
    $("modal-save").disabled = true;
  } else {
    $("modal-save").disabled = false;
  }

  $("modal").classList.remove("hidden");
}

// Wird bei Aussteller- oder Bezahlt-Änderung aufgerufen:
// schlägt einen neuen Status vor, aber nur wenn der User den Dropdown
// NICHT bereits manuell überschrieben hat.
function suggestStatusFromInputs() {
  if (modalStatusManuallyChanged) return;
  const name = $("modal-aussteller").value.trim();
  const bezahlt = $("modal-bezahlt").checked;
  $("modal-status").value = computeStatus(!!name, bezahlt);
}

function closeModal() {
  state.selectedStandNr = null;
  $("modal").classList.add("hidden");
  refreshStandsVisual();
}

// === Speichern ===
async function saveModal() {
  const standNr = $("modal-stand-nr").textContent;
  const info = state.standsByNr.get(standNr);
  if (!info) return closeModal();

  const notes = $("modal-notes").value;
  const bezahlt = $("modal-bezahlt").checked;
  const reNr = $("modal-re-nr").value.trim();
  const ausstellerName = $("modal-aussteller").value.trim();
  // Status: nimm den Wert aus dem Dropdown (User-Override möglich).
  const status = $("modal-status").value;

  // Aussteller auflösen — wenn name leer → keine Verknüpfung, sonst suchen/anlegen
  let ausstellerIds = [];
  if (ausstellerName) {
    let recId = state.ausstellerByName.get(ausstellerName.toLowerCase());
    if (!recId) {
      if (!confirm(`Aussteller "${ausstellerName}" existiert noch nicht. Neu anlegen?`)) {
        return;
      }
      try {
        const created = await createAussteller(state.token, ausstellerName);
        recId = created.id;
        state.ausstellerById.set(recId, { firmenname: ausstellerName, notizen: "" });
        state.ausstellerByName.set(ausstellerName.toLowerCase(), recId);
        refreshAusstellerDatalist();
      } catch (err) {
        alert(`Anlegen fehlgeschlagen: ${err.message}`);
        return;
      }
    }
    ausstellerIds = [recId];
  }

  const fields = {
    [FIELDS.status]: status,
    [FIELDS.aussteller]: ausstellerIds,
    [FIELDS.notes]: notes,
    [FIELDS.bezahlt]: bezahlt,
    [FIELDS.re_nr]: reNr,
  };

  // Optimistisches Update
  info.status = status;
  info.ausstellerIds = ausstellerIds;
  info.notes = notes;
  info.bezahlt = bezahlt;
  info.reNr = reNr;
  refreshStandsVisual();
  refreshStats();
  closeModal();

  // An Airtable senden — bei Fehler in Queue
  try {
    await updateStandplanRecord(state.token, info.recordId, fields);
    setSyncStatus("ok");
  } catch (err) {
    console.error("Speichern fehlgeschlagen — in Queue:", err);
    enqueueUpdate({ recordId: info.recordId, fields });
    setSyncStatus("error");
  }
}

// === Suche ===
function handleSearch(query) {
  state.searchHighlight.clear();
  const q = query.trim().toLowerCase();
  if (!q) {
    refreshStandsVisual();
    return;
  }

  // Erst: Standnummer?
  if (/^\d+$/.test(q)) {
    if (STAND_LAYOUT[q]) {
      state.searchHighlight.add(q);
      scrollToStand(q);
    }
  } else {
    // Nach Aussteller-Name suchen (Teilstring)
    const matchingAusstellerIds = [];
    for (const [recId, a] of state.ausstellerById) {
      if (a.firmenname.toLowerCase().includes(q)) matchingAusstellerIds.push(recId);
    }
    for (const [standNr, info] of state.standsByNr) {
      if (info.ausstellerIds.some((id) => matchingAusstellerIds.includes(id))) {
        state.searchHighlight.add(standNr);
      }
    }
    // Beim ersten Treffer hinscrollen
    const first = [...state.searchHighlight][0];
    if (first) scrollToStand(first);
  }
  refreshStandsVisual();
}

function scrollToStand(standNr) {
  const pos = STAND_LAYOUT[standNr];
  if (!pos) return;
  const targetX = pos.col * CELL_W + CELL_W / 2;
  const targetY = pos.row * CELL_H + CELL_H / 2;
  panZoom.centerOn(targetX, targetY);
}

// === Pan & Zoom (eigene Implementation, leichtgewichtig) ===
const panZoom = (() => {
  let scale = 1;
  let tx = 0;
  let ty = 0;
  const MAX_SCALE = 6;
  const svg = () => $("plan");
  const container = () => $("plan-container");

  // Min-Zoom = Plan füllt den Container — kein weiteres Rauszoomen
  function getFitScale() {
    const c = container().getBoundingClientRect();
    return Math.min(c.width / PLAN_W, c.height / PLAN_H);
  }
  function clampScale(s) {
    return Math.max(getFitScale(), Math.min(MAX_SCALE, s));
  }
  // Pan-Bounds: Plan kann nicht aus dem Container herausgezogen werden.
  // Wenn der Plan kleiner ist als der Container in einer Dimension → fix zentriert.
  function clampPan() {
    const c = container().getBoundingClientRect();
    const renderedW = PLAN_W * scale;
    const renderedH = PLAN_H * scale;
    if (renderedW <= c.width) {
      tx = (c.width - renderedW) / 2;
    } else {
      tx = Math.min(0, Math.max(c.width - renderedW, tx));
    }
    if (renderedH <= c.height) {
      ty = (c.height - renderedH) / 2;
    } else {
      ty = Math.min(0, Math.max(c.height - renderedH, ty));
    }
  }

  function apply() {
    scale = clampScale(scale);
    clampPan();
    svg().style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  }

  function fit() {
    scale = getFitScale();
    apply();
  }

  function centerOn(planX, planY) {
    const c = container().getBoundingClientRect();
    tx = c.width / 2 - planX * scale;
    ty = c.height / 2 - planY * scale;
    apply();
  }

  function zoomAt(factor, screenX, screenY) {
    const c = container().getBoundingClientRect();
    const localX = screenX - c.left;
    const localY = screenY - c.top;
    const newScale = clampScale(scale * factor);
    const ratio = newScale / scale;
    tx = localX - (localX - tx) * ratio;
    ty = localY - (localY - ty) * ratio;
    scale = newScale;
    apply();
  }

  // Mouse-Pan & Wheel-Zoom
  let panActive = false;
  let lastX = 0, lastY = 0;
  let downX = 0, downY = 0;

  function init() {
    const c = container();
    c.addEventListener("mousedown", (e) => {
      panActive = true;
      lastX = e.clientX;
      lastY = e.clientY;
      downX = e.clientX;
      downY = e.clientY;
    });
    window.addEventListener("mousemove", (e) => {
      if (!panActive) return;
      tx += e.clientX - lastX;
      ty += e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      apply();
    });
    window.addEventListener("mouseup", (e) => {
      const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
      panActive = false;
      // Wenn Maus weiter als 4px bewegt, Klick verhindern
      if (moved > 4) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);

    c.addEventListener("wheel", (e) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      zoomAt(factor, e.clientX, e.clientY);
    }, { passive: false });

    // Touch
    let touchStartDist = 0;
    let touchStartScale = 1;
    let touchMidpoint = null;
    let touchPanLastX = 0, touchPanLastY = 0;
    let touchDownX = 0, touchDownY = 0;
    let pinching = false;
    // Erst ab > 8px Fingerbewegung als Pan zählen — sonst werden
    // Tap-Klicks unterdrückt (touchmove preventDefault blockiert click).
    let panActiveTouch = false;
    const PAN_THRESHOLD = 8;

    c.addEventListener("touchstart", (e) => {
      if (e.touches.length === 1) {
        touchPanLastX = e.touches[0].clientX;
        touchPanLastY = e.touches[0].clientY;
        touchDownX = touchPanLastX;
        touchDownY = touchPanLastY;
        pinching = false;
        panActiveTouch = false;
      } else if (e.touches.length === 2) {
        pinching = true;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        touchStartDist = Math.hypot(dx, dy);
        touchStartScale = scale;
        touchMidpoint = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        };
      }
    }, { passive: true });

    c.addEventListener("touchmove", (e) => {
      if (e.touches.length === 1 && !pinching) {
        const totalDx = e.touches[0].clientX - touchDownX;
        const totalDy = e.touches[0].clientY - touchDownY;
        // Unter Schwellwert: noch als möglicher Tap behandeln, nicht pannen
        if (!panActiveTouch && Math.hypot(totalDx, totalDy) < PAN_THRESHOLD) {
          return;
        }
        panActiveTouch = true;
        const dx = e.touches[0].clientX - touchPanLastX;
        const dy = e.touches[0].clientY - touchPanLastY;
        tx += dx;
        ty += dy;
        touchPanLastX = e.touches[0].clientX;
        touchPanLastY = e.touches[0].clientY;
        apply();
        e.preventDefault();
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const newScale = clampScale(touchStartScale * (dist / touchStartDist));
        const ratio = newScale / scale;
        const rect = c.getBoundingClientRect();
        const localX = touchMidpoint.x - rect.left;
        const localY = touchMidpoint.y - rect.top;
        tx = localX - (localX - tx) * ratio;
        ty = localY - (localY - ty) * ratio;
        scale = newScale;
        apply();
        e.preventDefault();
      }
    }, { passive: false });

    c.addEventListener("touchend", (e) => {
      if (e.touches.length < 2) pinching = false;
      if (e.touches.length === 0) panActiveTouch = false;
    });

    window.addEventListener("resize", fit);
  }

  return { init, fit, centerOn };
})();

// === Pull-to-Refresh (sehr simpel) ===
function initPullToRefresh() {
  const container = $("plan-container");
  let startY = 0;
  let pulling = false;

  container.addEventListener("touchstart", (e) => {
    if (container.scrollTop === 0 && e.touches.length === 1) {
      startY = e.touches[0].clientY;
      pulling = true;
    }
  }, { passive: true });

  container.addEventListener("touchmove", (e) => {
    if (!pulling) return;
    const dy = e.touches[0].clientY - startY;
    if (dy > 80) {
      pulling = false;
      syncFromAirtable();
    }
  }, { passive: true });

  container.addEventListener("touchend", () => {
    pulling = false;
  });
}

// === App-Start ===
async function startApp() {
  $("app").classList.remove("hidden");
  $("token-screen").classList.add("hidden");

  renderPlan();
  panZoom.init();
  panZoom.fit();
  initPullToRefresh();

  // Listeners
  $("modal-cancel").addEventListener("click", closeModal);
  $("modal-save").addEventListener("click", saveModal);
  $("modal").addEventListener("click", (e) => {
    if (e.target.id === "modal") closeModal();
  });
  // Status-Vorschlag aktualisieren wenn Aussteller oder Bezahlt sich ändert
  $("modal-aussteller").addEventListener("input", suggestStatusFromInputs);
  $("modal-bezahlt").addEventListener("change", suggestStatusFromInputs);
  // Manuelles Ändern des Status: respektieren, keine Auto-Überschreibung mehr
  $("modal-status").addEventListener("change", () => {
    modalStatusManuallyChanged = true;
  });

  $("search").addEventListener("input", (e) => handleSearch(e.target.value));
  $("logout-btn").addEventListener("click", () => {
    if (confirm("Token entfernen und ausloggen?")) {
      clearToken();
      location.reload();
    }
  });
  $("sync-status").addEventListener("click", () => {
    if (state.syncError) {
      alert(`Sync-Fehler:\n\n${state.syncError}`);
    } else {
      syncFromAirtable();
    }
  });

  // Erste Synchronisation + Queue flushen
  await flushQueue();
  await syncFromAirtable();

  // Auto-Sync alle 30s
  state.syncTimer = setInterval(async () => {
    await flushQueue();
    await syncFromAirtable();
  }, SYNC_INTERVAL_MS);

  // Online-Event: Queue flushen
  window.addEventListener("online", async () => {
    await flushQueue();
    syncFromAirtable();
  });

  // Layout-Sanity
  const missing = validateLayout();
  if (missing.length) {
    console.warn("Fehlende Stände im Layout:", missing);
  }
}

// === Token-Login ===
function showTokenScreen() {
  $("app").classList.add("hidden");
  $("token-screen").classList.remove("hidden");
  const input = $("token-input");
  input.value = "";
  const errorEl = $("token-error");
  errorEl.textContent = "";

  $("token-save").onclick = async () => {
    const token = input.value.trim();
    if (!token) return;
    errorEl.textContent = "Prüfe Token …";
    try {
      const ok = await validateToken(token);
      if (!ok) {
        errorEl.textContent = "Token ungültig oder Base nicht erreichbar.";
        return;
      }
      saveToken(token);
      state.token = token;
      startApp();
    } catch (err) {
      errorEl.textContent = `Fehler: ${err.message}`;
    }
  };

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("token-save").click();
  });
}

// === Init ===
const existing = loadToken();
if (existing) {
  state.token = existing;
  startApp();
} else {
  showTokenScreen();
}
