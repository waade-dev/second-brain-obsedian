// Popup logic: read the active tab, build a markdown bullet, and append it
// directly to the vault file on disk. Works whether or not Obsidian is running.

const DEFAULTS = {
  notePath: "Bookmarks.md",
  defaultTags: ""
};

const els = {
  notConfigured: document.getElementById("not-configured"),
  form: document.getElementById("form"),
  openOptionsLink: document.getElementById("open-options-link"),
  settingsLink: document.getElementById("settings-link"),
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

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function allTags() {
  const defaults = settings.defaultTags
    .split(/[,\s]+/)
    .map(normalizeTag)
    .filter(Boolean);
  return [...new Set([...tags, ...defaults])];
}

function buildEntry() {
  const title = (currentTab.title || currentTab.url).replace(/[\[\]]/g, "");
  const url = currentTab.url;
  const note = els.note.value.trim();
  const tagStr = allTags().map((t) => "#" + t).join(" ");

  let line = `- [${title}](${url})`;
  if (note) line += ` — ${note}`;
  if (tagStr) line += ` ${tagStr}`;
  line += ` (${timestamp()})`;
  return "\n" + line;
}

async function save() {
  if (els.saveBtn.classList.contains("is-saving")) return;
  addTagFromInput(); // commit any half-typed tag

  const handle = await FS.getVaultHandle();
  if (!handle) {
    setStatus("No vault folder chosen. Open Settings first.", "err");
    return;
  }

  els.saveBtn.classList.add("is-saving");
  setStatus("");

  try {
    const allowed = await FS.ensurePermission(handle, "readwrite");
    if (!allowed) {
      els.saveBtn.classList.remove("is-saving");
      setStatus("Permission to write to the vault was denied.", "err");
      return;
    }

    await FS.appendToFile(handle, settings.notePath, buildEntry());

    els.saveBtn.classList.remove("is-saving");
    els.saveBtn.classList.add("is-saved");
    setStatus(`Saved to ${settings.notePath}`, "ok");
    setTimeout(() => window.close(), 850);
  } catch (e) {
    els.saveBtn.classList.remove("is-saving");
    setStatus(`Could not write to the vault: ${e.message || e}`, "err");
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

  const handle = await FS.getVaultHandle();
  if (!handle) {
    els.notConfigured.classList.remove("hidden");
    els.form.classList.add("hidden");
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
