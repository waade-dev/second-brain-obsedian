# Save to Obsidian — Browser Extension

A tiny Chrome/Edge/Brave extension. Click it on any page and it appends the
page as a bullet to a running **`Bookmarks.md`** note **directly in your vault
folder on disk**.

**Works whether or not Obsidian is open** — no plugins, no servers, no login.
It writes the markdown file itself; Obsidian shows the new links next time you
open the vault.

Each saved entry looks like:

```markdown
- [Page Title](https://example.com) — your note #read-later #ai (2026-06-26 14:30)
```

It captures: **URL + page title**, an optional **note** you type, optional
**tags**, and a **timestamp**.

---

## One-time setup

### 1. Load the extension

1. Go to `chrome://extensions` (or `edge://extensions` / `brave://extensions`).
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select this folder
   (`obsidian-saver-extension`).
4. Pin the extension to your toolbar (optional, makes it one click).

### 2. Choose your vault folder

1. Click the extension → **Settings** (opens automatically the first time).
2. Click **Choose vault folder…** and select the **root folder of your
   Obsidian vault**. Grant write access when the browser asks.
3. Leave **destination note** as `Bookmarks.md` (or change it).
4. Click **Save settings**.

That's it. Obsidian does **not** need to be running.

---

## Usage

1. On any page, click the extension.
2. (Optional) Type a note and/or tags.
3. Click **Save to Obsidian** — or press **Cmd/Ctrl + Enter**.

The link is appended to your `Bookmarks.md`. If the note doesn't exist yet, it's
created automatically.

---

## How it works

It uses the browser's **File System Access API**. You grant the extension
access to your vault folder once; the folder handle is remembered (stored in
IndexedDB) so it persists across browser restarts. Saving opens the file, seeks
to the end, and appends one line — no Obsidian process involved.

---

## Notes & troubleshooting

- **Permission prompt each session.** For security, the browser may ask you to
  re-confirm write access the first time you save after restarting it. Just
  click **Allow** — it appears once per session, on the Save click.
- **Editing the same note in Obsidian simultaneously?** Avoid having that exact
  note open and being edited in Obsidian at the moment you save, to prevent a
  rare write conflict. Obsidian auto-reloads the file otherwise.
- **Tags with spaces** become hyphenated (`read later` → `#read-later`).
- **Vault on a synced drive (iCloud/Dropbox/etc.)?** Works fine — the file is
  written normally and your sync tool picks it up.

---

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | Extension definition (Manifest V3) |
| `icons/` | Toolbar / store icons (16–128 px) |
| `fs.js` | File System Access helpers (folder handle + append) |
| `popup.html/.css/.js` | The save popup |
| `options.html/.css/.js` | Settings (choose vault folder, note path, tags) |

The UI adapts automatically to your system **light / dark** theme.
