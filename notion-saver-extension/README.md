# Save to Notion — concept books

Chrome / Chromium Manifest V3 extension, version 1.1.0. Saves the current page into your existing Notion database with a concept book, a chapter, notes, tags, and a stable save date.

## Use the update

1. Open `chrome://extensions`.
2. Find **Save to Notion** and click its **Reload** button. The existing unpacked extension directory was updated in place; keep the same directory and extension entry so your settings remain available.
3. Open a normal HTTP or HTTPS page and click the extension.
4. Choose its **Concept book**. These choices are read from your Notion table, rather than a fixed list in the extension.
5. Choose an existing **Subconcept / chapter** suggestion or type a new chapter name.
6. Add a note and tags if useful, then save. `Cmd/Ctrl + Enter` also works.

The light/dark button appears in both the popup and Settings. It follows your system initially and stores your manual choice locally for the extension.

## Notion table

| Property | Type | Purpose |
| --- | --- | --- |
| `Name` | Title | Saved article title |
| `URL` | URL | Original article link |
| `Tags` | Multi-select | Your original tags |
| `Note` | Text / rich text | Your note |
| `Saved` | Date | Set at save time; later edits do not move the article to a newer date |
| `Concept` | Select | The book the article belongs to |
| `Subconcept` | Select | Its chapter |

`my-brain` has already been migrated into AI & Machine Learning, Systems & Backend, Algorithms, and People & Learning. Its 11 original rows and all original field values were verified after migration. Add a new Concept option in Notion and reopen the popup to make that book available. New chapter names can be entered directly in the popup.

Other configured databases continue working without concept fields. Databases using automatic Created time for `Saved` are still supported; the client writes a save date only when that property is a Date.

## Connection

Existing token and database settings are retained. The extension calls Notion directly under its existing `https://api.notion.com/*` host permission; no additional permissions were introduced. The client now uses the data-source API and creates pages under the selected data source.

For a new setup, create a Notion internal connection with read and insert access, grant it access to the intended database, and enter its token and database URL in Settings. New Select or Multi-select options may also require update access to the data source.

If a database has multiple data sources, fill in the optional **Data source ID** beneath its database row. Single-source databases are selected automatically. Use **Test this database** in Settings to verify access.

The website is independent of extension storage. Configure its server token in Vercel to enable website live sync. This update does not copy or expose the extension’s stored token.

## Behavior fixes

- Concept choices refresh from Notion whenever the popup opens or its database changes.
- Chapter suggestions are queried for the chosen concept. A chapter can still be typed if suggestions are temporarily unavailable.
- Tags retain their original case, spaces, and `#` prefixes. Use Enter or a comma to commit a tag; spaces no longer split a tag into separate words. Separate default tags with commas.
- Save stays disabled after a successful submission, including the keyboard shortcut, to prevent accidental duplicate rows.
- Browser-internal URLs are blocked before submission.
- Long notes are split into valid Notion rich-text fragments.
- Existing settings and multiple-database selection are retained.

## Verification

Run the six client tests with:

```sh
node --test tests/notion.test.cjs
```

Tests verify the page payload, date handling, tags, long notes, ID parsing, chapter queries, and compatibility with automatic Created time. Popup inputs, theme switching, Settings, and duplicate-save prevention were also exercised in a local UI fixture. That fixture does not ship with this extension and did not create a real Notion test row. A real save from the reloaded installed extension still needs to be checked using its existing token.
