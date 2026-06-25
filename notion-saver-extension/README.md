# Save to Notion — Browser Extension

A tiny Chrome/Edge/Brave extension. Click it on any page and it adds a **row to
your Notion database** with the page's title, URL, your note, tags, and a
timestamp.

Talks to the **Notion API** directly — works from anywhere, whether or not the
Notion app is open.

---

## One-time setup

### 1. Create a Notion integration
1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations) →
   **New integration** (Internal).
2. Copy the **Internal Integration Secret** (starts with `ntn_`).

### 2. Prepare your database
Create a database with these columns (exact names + types matter):

| Column | Type |
|--------|------|
| `Name` | Title |
| `URL` | URL |
| `Tags` | Multi-select |
| `Note` | Text |
| `Saved` | Created time |

Then **share it with your integration**: open the database → top-right `•••` →
**Connections** → add your integration. *(This is the step everyone forgets — without
it the API can't see the database.)*

### 3. Load the extension
1. Go to `chrome://extensions` → enable **Developer mode** → **Load unpacked** →
   select this `notion-saver-extension` folder.
2. Pin it to your toolbar.

### 4. Connect it
1. Click the extension → **Settings**.
2. Paste your **Integration token** and the database **URL** (or 32-char ID).
3. Click **Test connection** — you should see *“Connected to … ✓”*. Then
   **Save settings**.

---

## Usage
1. On any page, click the extension.
2. (Optional) add a note and/or tags.
3. Click **Save to Notion** — or press **Cmd/Ctrl + Enter**.

A new row appears in your database. The `Saved` column is filled automatically.

---

## Troubleshooting
- **“Database not found — did you share it with the integration?”** Open the DB →
  `•••` → Connections → add your integration.
- **“Could not find property …” / validation errors.** Your column **names/types**
  don't match the table above (case-sensitive: `Name`, `URL`, `Tags`, `Note`).
- **401 / unauthorized.** Re-copy the token; make sure it's the *Internal
  Integration Secret*, not the integration's ID.
- Pasted database **URL** works — the extension extracts the ID for you.

---

## Files
| File | Purpose |
|------|---------|
| `manifest.json` | Extension definition (Manifest V3) |
| `icons/` | Toolbar icons |
| `notion.js` | Notion API client (create row, test connection) |
| `popup.html/.css/.js` | The save popup |
| `options.html/.css/.js` | Settings (token, database, default tags) |

The UI adapts automatically to your system light / dark theme.
