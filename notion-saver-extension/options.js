const DEFAULTS = {
  token: "",
  databases: [], // [{ name, databaseId }]
  selectedDb: "",
  defaultTags: "",
  databaseId: "" // legacy single-db field, migrated on load
};

const els = {
  token: document.getElementById("token"),
  dbList: document.getElementById("db-list"),
  addDb: document.getElementById("add-db"),
  defaultTags: document.getElementById("defaultTags"),
  saveBtn: document.getElementById("save-btn"),
  status: document.getElementById("status")
};

let statusTimer = null;
function setStatus(msg, kind, sticky) {
  els.status.textContent = msg || "";
  els.status.className = "status" + (kind ? " " + kind : "");
  if (statusTimer) clearTimeout(statusTimer);
  if (msg && !sticky) statusTimer = setTimeout(() => setStatus(""), 4000);
}

// Build one editable database row.
function addDbRow(name = "", url = "") {
  const item = document.createElement("div");
  item.className = "db-item";

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.className = "db-name";
  nameInput.placeholder = "Name (e.g. Reading)";
  nameInput.value = name;

  const urlInput = document.createElement("input");
  urlInput.type = "text";
  urlInput.className = "db-url";
  urlInput.placeholder = "Database URL or 32-char ID";
  urlInput.value = url;

  const testBtn = document.createElement("button");
  testBtn.type = "button";
  testBtn.className = "icon-btn-sm";
  testBtn.title = "Test this database";
  testBtn.textContent = "✓";
  testBtn.addEventListener("click", () => testRow(nameInput, urlInput, testBtn));

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "icon-btn-sm";
  removeBtn.title = "Remove";
  removeBtn.textContent = "×";
  removeBtn.addEventListener("click", () => item.remove());

  item.append(nameInput, urlInput, testBtn, removeBtn);
  els.dbList.appendChild(item);
  return item;
}

function collectDatabases() {
  const out = [];
  els.dbList.querySelectorAll(".db-item").forEach((item) => {
    const name = item.querySelector(".db-name").value.trim();
    const raw = item.querySelector(".db-url").value.trim();
    if (!raw) return;
    out.push({ name: name || "Untitled", databaseId: NOTION.parseDatabaseId(raw) });
  });
  return out;
}

function load() {
  chrome.storage.sync.get(DEFAULTS, (s) => {
    els.token.value = s.token || "";
    els.defaultTags.value = s.defaultTags || "";

    let dbs = Array.isArray(s.databases) ? s.databases : [];
    if (!dbs.length && s.databaseId) dbs = [{ name: "My database", databaseId: s.databaseId }];

    els.dbList.innerHTML = "";
    if (dbs.length) dbs.forEach((d) => addDbRow(d.name, d.databaseId));
    else addDbRow(); // start with one empty row
  });
}

async function testRow(nameInput, urlInput, btn) {
  const token = els.token.value.trim();
  const raw = urlInput.value.trim();
  if (!token) return setStatus("Enter the integration token first.", "err");
  if (!raw) return setStatus("Enter the database URL to test.", "err");

  btn.className = "icon-btn-sm";
  setStatus(`Testing ${nameInput.value || "database"}…`, "", true);
  try {
    const db = await NOTION.retrieveDatabase({
      token,
      databaseId: NOTION.parseDatabaseId(raw)
    });
    const title = (db.title && db.title[0] && db.title[0].plain_text) || "database";
    if (!nameInput.value.trim()) nameInput.value = title; // auto-fill name
    btn.classList.add("ok");
    setStatus(`Connected to “${title}” ✓`, "ok");
  } catch (e) {
    btn.classList.add("err");
    let msg = e.message || "Connection failed.";
    if (/Could not find database/i.test(msg)) {
      msg = "Database not found — did you share it with the integration?";
    }
    setStatus(msg, "err", true);
  }
}

function save() {
  const token = els.token.value.trim();
  const databases = collectDatabases();
  if (!token) return setStatus("Enter the integration token.", "err");
  if (!databases.length) return setStatus("Add at least one database.", "err");

  // Reflect normalized IDs back into the rows.
  const items = els.dbList.querySelectorAll(".db-item");
  databases.forEach((d, i) => {
    if (items[i]) items[i].querySelector(".db-url").value = d.databaseId;
  });

  chrome.storage.sync.get({ selectedDb: "" }, ({ selectedDb }) => {
    const valid = databases.some((d) => d.databaseId === selectedDb);
    chrome.storage.sync.set(
      {
        token,
        databases,
        defaultTags: els.defaultTags.value.trim(),
        selectedDb: valid ? selectedDb : databases[0].databaseId,
        databaseId: "" // clear legacy field
      },
      () => setStatus("Settings saved ✓", "ok")
    );
  });
}

els.addDb.addEventListener("click", () => addDbRow());
els.saveBtn.addEventListener("click", save);
load();
