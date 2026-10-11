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
  status: document.getElementById("status"),
  conceptFields: document.getElementById("concept-fields"),
  concept: document.getElementById("concept"),
  subconcept: document.getElementById("subconcept"),
  chapterOptions: document.getElementById("chapter-options"),
  schemaInfo: document.getElementById("schema-info")
};

let settings = { ...DEFAULTS };
let currentTab = null;
let tags = [];
let databases = [];
let selectedDb = "";
let schemaContext = null;
let schemaGeneration = 0;
let chapterGeneration = 0;
let saved = false;

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
  return String(raw).trim();
}

function renderChips() {
  els.chips.innerHTML = "";
  tags.forEach((tag, i) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.append(document.createTextNode(tag + " "));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.setAttribute("aria-label", `Remove ${tag}`);
    remove.textContent = "×";
    chip.append(remove);
    remove.addEventListener("click", (e) => {
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
    .split(",")
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
      if (els.saveBtn.classList.contains("is-saving") || saved) return;
      selectedDb = db.databaseId;
      chrome.storage.sync.set({ selectedDb });
      renderDbBar();
      loadSchema();
    });
    els.dbBar.appendChild(pill);
  });
}

async function save() {
  if (els.saveBtn.classList.contains("is-saving") || saved || els.saveBtn.disabled) return;
  addTagFromInput(); // commit any half-typed tag

  if (!settings.token || !databases.length) {
    setStatus("Not connected to Notion. Open Settings first.", "err");
    return;
  }
  if (!currentTab?.url || !/^https?:\/\//i.test(currentTab.url)) {
    setStatus("Open an http or https page to save it.", "err");
    return;
  }
  if (!schemaContext) return setStatus("The database is still loading. Try again shortly.", "err");
  if (!els.conceptFields.classList.contains("hidden") && (!els.concept.value || !els.subconcept.value.trim())) {
    setStatus("Choose a concept book and a chapter before saving.", "err");
    (!els.concept.value ? els.concept : els.subconcept).focus();
    return;
  }

  els.saveBtn.classList.add("is-saving");
  els.saveBtn.disabled = true;
  setStatus("");

  try {
    const { skipped } = await NOTION.createPage({
      token: settings.token,
      databaseId: selectedDb,
      title: currentTab.title || currentTab.url,
      url: currentTab.url,
      note: els.note.value.trim(),
      tags: allTags(),
      context: schemaContext,
      concept: els.conceptFields.classList.contains("hidden") ? "" : els.concept.value,
      subconcept: els.conceptFields.classList.contains("hidden") ? "" : els.subconcept.value.trim()
    });

    chrome.storage.sync.set({ selectedDb }); // remember choice
    chrome.storage.local.set({ lastConcept: els.concept.value });
    saved = true;
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
    els.saveBtn.disabled = false;
    setStatus(e.message || "Could not save to Notion.", "err");
  }
}

function setupTagInput() {
  els.tagsBox.addEventListener("click", () => els.tagsInput.focus());
  els.tagsInput.addEventListener("focus", () => els.tagsBox.classList.add("focused"));
  els.tagsInput.addEventListener("blur", () => els.tagsBox.classList.remove("focused"));
  els.tagsInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === ",") {
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

async function loadChapters() {
  const generation = ++chapterGeneration;
  const concept = els.concept.value;
  els.chapterOptions.replaceChildren();
  if (!concept || !schemaContext) return;
  try {
    const names = await NOTION.getChapters({ token: settings.token, context: schemaContext, concept });
    if (generation !== chapterGeneration || concept !== els.concept.value) return;
    els.chapterOptions.replaceChildren(...names.map(name => new Option(name, name)));
  } catch {
    // New chapter names still work when suggestions are temporarily unavailable.
  }
}

async function loadSchema() {
  const generation = ++schemaGeneration;
  ++chapterGeneration;
  schemaContext = null;
  els.saveBtn.disabled = true;
  els.conceptFields.classList.add("hidden");
  els.schemaInfo.textContent = "Reading your Notion columns…";
  els.concept.replaceChildren(new Option("Choose a book…", ""));
  els.subconcept.value = "";
  els.chapterOptions.replaceChildren();
  const db = databases.find(db => db.databaseId === selectedDb);
  try {
    const context = await NOTION.retrieveDatabase({ token: settings.token, databaseId: selectedDb, dataSourceId: db?.dataSourceId });
    if (generation !== schemaGeneration) return;
    schemaContext = context;
    const hasConcepts = context.properties.Concept?.type === "select" && context.properties.Subconcept?.type === "select";
    if (hasConcepts) {
      const names = (context.properties.Concept.select.options || []).map(option => option.name);
      els.concept.append(...names.map(name => new Option(name, name)));
      els.conceptFields.classList.remove("hidden");
      els.schemaInfo.textContent = "Books and chapter suggestions come from this Notion table.";
      chrome.storage.local.get({ lastConcept: "" }, ({ lastConcept }) => {
        if (generation !== schemaGeneration) return;
        if (names.includes(lastConcept)) els.concept.value = lastConcept;
        loadChapters();
      });
    } else {
      els.schemaInfo.textContent = "This database saves links without concept fields.";
    }
    els.saveBtn.disabled = !/^https?:\/\//i.test(currentTab?.url || "");
    if (els.saveBtn.disabled) setStatus("Open an http or https page to save it.", "err");
  } catch (error) {
    if (generation !== schemaGeneration) return;
    els.schemaInfo.textContent = "Could not read this database. Check its connection in Settings.";
    setStatus(error.message, "err");
  }
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
    loadSchema();
  }

  setupTagInput();
  els.saveBtn.addEventListener("click", save);
  els.concept.addEventListener("change", () => { els.subconcept.value = ""; loadChapters(); });
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
