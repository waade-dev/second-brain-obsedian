# Amith’s library

A personal library for the existing `my-brain` Notion database. The frontend groups your saves into concept books. A selected cover rises within the reader and swings open on its spine to reveal the contents spread; the animation stays clipped to the book’s bounds. Chapters reveal articles, notes, original tags, and saved dates. The animation adapts to mobile, respects reduced motion, and can be dismissed at any point. Article links open in a new tab. Light and dark modes follow your system initially and remember your manual choice.

The Notion table has been migrated: `Concept` and `Subconcept` are Select properties, and `Saved` is now an explicit Date. The original 11 rows retained every title, URL, tag, note, and visible saved timestamp. The reader uses those seven properties. Add book appends Concept options, and optionally Subconcept options, while retaining all existing options by ID. Tags retain their original spelling and remain separate, including `big`, `brains`, and `big-brains`.

## Current state

- Frontend built and checked in the browser on desktop and at 320px and 390px mobile widths.
- Library reader and protected book-creation endpoint implemented; twenty-four automated checks passed using mock Notion responses.
- No dependencies or build step required.
- Not deployed: you chose to deploy it yourself.
- Live Notion access has not been tested because no API token has been configured. The browser could read your table, but the existing connected Notion tool could not access this database.
- The initial preview uses a real snapshot of the 12 rows visible on 12 October 2026, grouped into four books and eleven chapters, including the new GrokBot save. Snapshot dates use Asia/Kolkata, matching the visible timestamps. This snapshot is not an ongoing connection or a guarantee of the database’s complete contents.

## Connect Notion

1. Open the [Notion Developer portal](https://www.notion.so/profile/integrations) and create an internal connection for the workspace containing `my-brain`. The workspace owner may need to do this.
2. Enable **Read content** for reading the library. To use **Add book**, also enable **Update content** so the app can append Select options. It does not create placeholder article rows.
3. On the database or its parent page, open `••• → Connections → Add connection`, then select the connection. This grants access without modifying the database’s columns or saved rows. Alternatively, select the database under the connection’s **Content access** tab.
4. Copy the connection token into Vercel’s environment variables. Keep it out of frontend code, Git, and chat.

Official reference: [Internal connections and page access](https://developers.notion.com/guides/get-started/internal-connections).

## Deploy to Vercel

Extract the source ZIP, open a terminal in its `notion-library` folder, then run:

```sh
npx vercel login
npx vercel --prod
```

Accept a new project for this folder. The included `vercel.json` selects the static `public` directory and the `/api/library` Node function. If asked for a framework, choose **Other**. There is no build command. Node 24 is specified in `package.json`.

You can also push this folder as its own Git repository and import it into Vercel. If you include it in a larger repository, set Vercel’s Root Directory to this folder.

In **Vercel → Project → Settings → Environment Variables**, add:

| Variable | Value |
| --- | --- |
| `NOTION_TOKEN` | Your internal connection token; mark it Sensitive where available |
| `NOTION_DATABASE_ID` | `38aab648-4e24-80fb-9d96-c3c7f555d2f5` |
| `NOTION_DATA_SOURCE_ID` | Optional; only needed to select a source when this database has multiple sources |
| `LIBRARY_EDIT_KEY` | A private edit key of at least 16 characters; required by Add book |

Enable the variables for the deployment environments you use, then **redeploy**. Environment variable changes apply to new deployments.

The supplied database ID was observed in your open Notion page’s **Open as full page** link. If Notion reports that the connection cannot read the database, first check that the connection belongs to the correct workspace and has page access. If needed, use the database’s own copied ID.

Once connected, the top-right status becomes **Connected to Notion**. Save a new article through your existing browser extension, then refresh the library to confirm it appears. Normal updates happen approximately every minute while the page is open; refresh and returning to the tab also request an update. Notion reads may be cached for up to 20 seconds by a warm server instance; manual refresh requests fresh data, with a one-second minimum cache age.

Production hosting makes the library and its returned bookmark data available to whoever can access the deployment. Use Vercel deployment protection if you want to keep your library private. The bundled `public/snapshot.json` also contains the 12 preview rows; remove it if you do not want to publish that fallback snapshot.

Official reference: [Vercel’s Node function runtime](https://vercel.com/docs/functions/runtimes/node-js).

## Run locally

Node 24 or newer is required. No package installation is necessary.

```sh
npm run dev
```

Open `http://127.0.0.1:4173`. Without credentials it displays the labeled Notion snapshot.

To test live data locally, copy `.env.example` to `.env.local`, add your Notion token, and refresh the page. The local preview reloads these configuration values on each API request; a restart is only needed after server code changes. `.env.local` is ignored by Git and excluded from Vercel uploads. Do not use a `VITE_` or `NEXT_PUBLIC_` variable for the token.

```sh
npm test
```

## How it works

- `public/`: buildless HTML, shelf and open-book styles, frontend, grouping model, theme preference, icon, and the migrated snapshot.
- `api/books.js`: authenticated POST endpoint for adding book/chapter choices. Enter your server’s `LIBRARY_EDIT_KEY` in the Add book dialog; it is cleared when the dialog closes and is never persisted in browser storage.
- `api/library.js`: GET-only endpoint for the browser. Keeps the token on the server and deduplicates concurrent loads in a warm function instance.
- `lib/book-writer.js`: appends select choices using current option IDs, rejects duplicates, and leaves existing article rows unchanged.
- `lib/notion.js`: reads the database’s data source and follows pagination, and reads Concept select options from the data source schema so newly created concepts appear even before their first save. Its POST calls go only to Notion’s read-only `/query` endpoint; it never creates, updates, or deletes anything.
- `tests/`: checks property mapping, pagination, source selection, missing configuration, permission failures, concept grouping, chapter and article search, safe article URLs, new empty concepts, snapshot refresh behavior, edit-key checks, duplicate rejection, and preservation of existing Notion select options.
- `dev-server.mjs`: local preview server; serves only `public` and the reader endpoint, not `.env` or source files.

The reader supports up to 5,000 rows per request and reports incomplete collections instead of silently truncating them. Larger libraries need incremental sync. If Notion briefly fails after a successful load, the page keeps its last loaded collection and retries. Search checks names, URLs, original tags, notes, concepts, and chapters. Sort options are recent, topic, colour, and title; the table does not contain article length or reading time, so those metrics are not invented.

## Updated extension

Reload **Save to Notion** at `chrome://extensions` after the source-folder update. Its new Concept book and Subconcept / chapter inputs read this table. Choose an existing chapter or type a new one. New saves write `Saved` once and keep the original tags, including spaces and `#` prefixes. The extension has its own light/dark preference.

The extension still uses its existing connection token. The website needs its separate Vercel environment configuration; no token is embedded in the site or copied from browser storage.

New Concept select options appear as books after the next live refresh, including empty books. Chapters come from the Subconcept assignments on saved rows. Snapshot mode reloads its saved file on refresh and clearly states that it cannot observe subsequent Notion edits.

## Add books and search inside them

Use **＋ Add book** next to the collection heading. Enter a concept name, optionally add a first chapter choice, and supply your library edit key. The book is saved as a Notion Concept option and appears on the shelf without adding a fake article. A first chapter is added as a Subconcept option; it appears inside the book after you save the first link with that Concept and Subconcept in the extension.

Every open book has a search field above its contents. Search checks chapter names, article titles, URLs, notes, and original tags. All search words must match, in any order. Results highlight matches and include a chapter button that opens the complete chapter; article titles still open the original link. Clearing search restores the current contents or chapter.

Add book requires the live Notion token, database access, Update content permission, and `LIBRARY_EDIT_KEY`. A snapshot cannot save new books. API writes were verified against mocked Notion responses; a real save still awaits server credential configuration. The UI also received a separate mock server check, which never wrote test data to Notion.

Schema writes use Notion’s [Update data source properties](https://developers.notion.com/reference/update-data-source-properties) endpoint. Every existing Select option ID is included so omitted options are not removed.
