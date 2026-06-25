// Popup logic: read the active tab, let the user pick a database, and create a
// row in the selected Notion database.

const DEFAULTS = {
  token: "",
  databases: [], // [{ name, databaseId }]
  selectedDb: "", // databaseId of the last-used database
  defaultTags: "",
  // legacy single-db fields (migrated on load)
  databaseId: ""
};

const els = {
  notConfigured: document.getElementById("not-configured"),
  form: document.getElementById("form"),
  openOptionsLink: document.getElementById("open-options-link"),
  settingsLink: document.getElementById("settings-link"),
  dbBar: document.getElementById("db-bar"),
  favicon: document.getElementById("favicon"),
  pageTitle: document.getElementById("page-title"),
  pageDomain: document.getElementById("page-domain"),
  note: document.getElementById("note"),
  tagsBox: document.getElementById("tags-box"),
  chips: document.getElementById("chips"),
  tagsInput: document.getElementById("tags-input"),
  saveBtn: document.getElementById("save-btn"),
  status: document.getElementById("status")
};

let settings = { ...DEFAULTS };
let currentTab = null;
let tags = [];
let databases = [];
let selectedDb = "";

const FALLBACK_FAVICON =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%239a9aa6" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>`
  );

function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULTS, (stored) => resolve({ ...DEFAULTS, ...stored }));
  });
}

function getActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs[0] || null));
  });
}

function setStatus(msg, kind) {
  els.status.textContent = msg || "";
  els.status.className = "status" + (kind ? " " + kind : "");
}

function normalizeTag(raw) {
  return raw.trim().replace(/^#/, "").replace(/\s+/g, "-").toLowerCase();
}

function renderChips() {
  els.chips.innerHTML = "";
  tags.forEach((tag, i) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.innerHTML = `#${tag} <button type="button" aria-label="Remove ${tag}">&times;</button>`;
    chip.querySelector("button").addEventListener("click", (e) => {
      e.stopPropagation();
      tags.splice(i, 1);
      renderChips();
    });
    els.chips.appendChild(chip);
  });
}

function addTagFromInput() {
  const t = normalizeTag(els.tagsInput.value);
  if (t && !tags.includes(t)) tags.push(t);
  els.tagsInput.value = "";
  renderChips();
}

function allTags() {
  const defaults = settings.defaultTags
    .split(/[,\s]+/)
    .map(normalizeTag)
    .filter(Boolean);
  return [...new Set([...tags, ...defaults])];
}

function renderDbBar() {
  els.dbBar.innerHTML = "";
  if (databases.length <= 1) return; // no need to show a single-choice bar
  databases.forEach((db) => {
    const pill = document.createElement("button");
    pill.className = "db-pill" + (db.databaseId === selectedDb ? " active" : "");
    pill.textContent = db.name || "Untitled";
    pill.setAttribute("role", "tab");
    pill.addEventListener("click", () => {
      selectedDb = db.databaseId;
      chrome.storage.sync.set({ selectedDb });
      renderDbBar();
    });
    els.dbBar.appendChild(pill);
  });
}

async function save() {
  if (els.saveBtn.classList.contains("is-saving")) return;
  addTagFromInput(); // commit any half-typed tag

  if (!settings.token || !databases.length) {
    setStatus("Not connected to Notion. Open Settings first.", "err");
    return;
  }

  els.saveBtn.classList.add("is-saving");
  setStatus("");

  try {
    const { skipped } = await NOTION.createPage({
      token: settings.token,
      databaseId: selectedDb,
      title: currentTab.title || currentTab.url,
      url: currentTab.url,
      note: els.note.value.trim(),
      tags: allTags()
    });

    chrome.storage.sync.set({ selectedDb }); // remember choice
    els.saveBtn.classList.remove("is-saving");
    els.saveBtn.classList.add("is-saved");

    const dbName = (databases.find((d) => d.databaseId === selectedDb) || {}).name || "Notion";
    if (skipped && skipped.length) {
      setStatus(`Saved to ${dbName} — no ${skipped.join(" / ")} column`, "ok");
      setTimeout(() => window.close(), 1800);
    } else {
      setStatus(`Saved to ${dbName}`, "ok");
      setTimeout(() => window.close(), 850);
    }
  } catch (e) {
    els.saveBtn.classList.remove("is-saving");
    setStatus(e.message || "Could not save to Notion.", "err");
  }
}

function setupTagInput() {
  els.tagsBox.addEventListener("click", () => els.tagsInput.focus());
  els.tagsInput.addEventListener("focus", () => els.tagsBox.classList.add("focused"));
  els.tagsInput.addEventListener("blur", () => els.tagsBox.classList.remove("focused"));
  els.tagsInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === "," || e.key === " ") {
      if (els.tagsInput.value.trim()) {
        e.preventDefault();
        addTagFromInput();
      }
    } else if (e.key === "Backspace" && !els.tagsInput.value && tags.length) {
      tags.pop();
      renderChips();
    }
  });
}

async function init() {
  settings = await getSettings();

  // Migrate legacy single-database config into the list form.
  databases = Array.isArray(settings.databases) ? settings.databases.slice() : [];
  if (!databases.length && settings.databaseId) {
    databases = [{ name: "My database", databaseId: settings.databaseId }];
  }
  // Resolve the selected database.
  if (!databases.some((d) => d.databaseId === settings.selectedDb)) {
    selectedDb = databases.length ? databases[0].databaseId : "";
  } else {
    selectedDb = settings.selectedDb;
  }

  currentTab = await getActiveTab();
  if (currentTab) {
    els.pageTitle.textContent = currentTab.title || "(untitled)";
    try {
      els.pageDomain.textContent = new URL(currentTab.url).hostname.replace(/^www\./, "");
    } catch {
      els.pageDomain.textContent = currentTab.url || "";
    }
    els.favicon.src = currentTab.favIconUrl || FALLBACK_FAVICON;
    els.favicon.addEventListener("error", () => (els.favicon.src = FALLBACK_FAVICON));
  }

  if (!settings.token || !databases.length) {
    els.notConfigured.classList.remove("hidden");
    els.form.classList.add("hidden");
  } else {
    renderDbBar();
  }

  setupTagInput();
  els.saveBtn.addEventListener("click", save);
  const openOpts = (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  };
  els.openOptionsLink.addEventListener("click", openOpts);
  els.settingsLink.addEventListener("click", openOpts);

  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") save();
  });

  els.note.focus();
}

init();
