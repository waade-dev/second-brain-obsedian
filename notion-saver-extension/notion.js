// Notion API client. The extension talks to api.notion.com directly — MV3
// host_permissions grant the cross-origin access that normal web pages can't.
// Used by popup.js and options.js.

const NOTION = (() => {
  const API = "https://api.notion.com/v1";
  const VERSION = "2022-06-28";

  function headers(token) {
    return {
      Authorization: `Bearer ${token}`,
      "Notion-Version": VERSION,
      "Content-Type": "application/json"
    };
  }

  async function asError(res) {
    const data = await res.json().catch(() => ({}));
    return new Error(data.message || `Notion error ${res.status}`);
  }

  // Accepts a raw 32-char id, a hyphenated UUID, or a full database URL.
  function parseDatabaseId(input) {
    const before = String(input).split("?")[0].replace(/-/g, "");
    const matches = before.match(/[0-9a-fA-F]{32}/g);
    return matches ? matches[matches.length - 1] : String(input).trim();
  }

  // Find a property in the DB schema by type, preferring a name match.
  // schema = db.properties, an object keyed by property name.
  function findProp(schema, type, namePatterns) {
    const entries = Object.entries(schema);
    for (const re of namePatterns) {
      const hit = entries.find(([name, def]) => def.type === type && re.test(name));
      if (hit) return hit[0];
    }
    const any = entries.find(([, def]) => def.type === type);
    return any ? any[0] : null;
  }

  // Create one page (row). The database schema is read first so we map to
  // whatever columns actually exist — missing ones (e.g. Tags/Note) are simply
  // skipped instead of erroring. Created-time columns (e.g. "Saved") are filled
  // by Notion automatically.
  async function createPage({ token, databaseId, title, url, note, tags }) {
    const db = await retrieveDatabase({ token, databaseId });
    const schema = db.properties || {};

    const properties = {};
    const skipped = [];

    const titleName = findProp(schema, "title", [/name/i, /title/i]);
    if (titleName) {
      properties[titleName] = { title: [{ text: { content: title || url || "Untitled" } }] };
    }

    if (url) {
      const urlName = findProp(schema, "url", [/url/i, /link/i]);
      if (urlName) properties[urlName] = { url };
      else skipped.push("URL");
    }

    if (tags && tags.length) {
      const tagsName = findProp(schema, "multi_select", [/tag/i, /label/i]);
      if (tagsName) properties[tagsName] = { multi_select: tags.map((name) => ({ name })) };
      else skipped.push("Tags");
    }

    if (note) {
      const noteName = findProp(schema, "rich_text", [/note/i, /comment/i, /desc/i]);
      if (noteName) properties[noteName] = { rich_text: [{ text: { content: note } }] };
      else skipped.push("Note");
    }

    const res = await fetch(`${API}/pages`, {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties
      })
    });
    if (!res.ok) throw await asError(res);
    const page = await res.json();
    return { page, skipped }; // skipped = fields with no matching column
  }

  // Verify the token can see the database. Returns the database object.
  async function retrieveDatabase({ token, databaseId }) {
    const res = await fetch(`${API}/databases/${databaseId}`, {
      headers: headers(token)
    });
    if (!res.ok) throw await asError(res);
    return res.json();
  }

  return { parseDatabaseId, createPage, retrieveDatabase };
})();
