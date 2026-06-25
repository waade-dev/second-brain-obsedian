const DEFAULTS = {
  notePath: "Bookmarks.md",
  defaultTags: ""
};

const els = {
  pickBtn: document.getElementById("pick-btn"),
  folderPill: document.getElementById("folder-pill"),
  folderName: document.getElementById("folder-name"),
  notePath: document.getElementById("notePath"),
  defaultTags: document.getElementById("defaultTags"),
  saveBtn: document.getElementById("save-btn"),
  status: document.getElementById("status")
};

let statusTimer = null;
function setStatus(msg, kind) {
  els.status.textContent = msg || "";
  els.status.className = "status" + (kind ? " " + kind : "");
  if (statusTimer) clearTimeout(statusTimer);
  if (msg) statusTimer = setTimeout(() => setStatus(""), 3500);
}

function showFolder(handle) {
  if (handle) {
    els.folderName.textContent = handle.name;
    els.folderPill.classList.add("set");
  } else {
    els.folderName.textContent = "No folder selected";
    els.folderPill.classList.remove("set");
  }
}

function load() {
  chrome.storage.sync.get(DEFAULTS, (s) => {
    els.notePath.value = s.notePath || DEFAULTS.notePath;
    els.defaultTags.value = s.defaultTags || "";
  });
  FS.getVaultHandle().then(showFolder);
}

async function pickFolder() {
  try {
    const handle = await FS.pickVaultFolder(); // also requests write permission
    showFolder(handle);
    setStatus(`Vault set to “${handle.name}”`, "ok");
  } catch (e) {
    if (e && e.name === "AbortError") return; // user cancelled
    setStatus(`Could not select folder: ${e.message || e}`, "err");
  }
}

function save() {
  const values = {
    notePath: els.notePath.value.trim() || DEFAULTS.notePath,
    defaultTags: els.defaultTags.value.trim()
  };
  chrome.storage.sync.set(values, () => setStatus("Settings saved ✓", "ok"));
}

els.pickBtn.addEventListener("click", pickFolder);
els.saveBtn.addEventListener("click", save);
load();
