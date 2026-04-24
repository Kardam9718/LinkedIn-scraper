const sessions = new Map(); // tabId -> { maxPages, currentPage, rowsMap }

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === "OPEN_SEARCH_TAB" && message.url) {
    chrome.tabs.create({ url: message.url }, (tab) => {
      if (!tab?.id) return;
      sessions.set(tab.id, {
        maxPages: message.maxPages || 1,
        currentPage: 1,
        rowsMap: new Map() // key: linkedin url
      });
    });
  }

  if (message.type === "PAGE_DATA" && sender.tab?.id) {
    const tabId = sender.tab.id;
    const session = sessions.get(tabId);
    if (!session) return;

    // merge + dedupe by LinkedIn URL
    for (const row of message.rows || []) {
      if (!row.url) continue;
      if (!session.rowsMap.has(row.url)) {
        session.rowsMap.set(row.url, row);
      } else {
        // merge missing fields if needed
        const existing = session.rowsMap.get(row.url);
        session.rowsMap.set(row.url, {
          name: existing.name || row.name,
          headline: existing.headline || row.headline,
          url: existing.url || row.url,
          email: mergePipeValues(existing.email, row.email),
          phone: mergePipeValues(existing.phone, row.phone)
        });
      }
    }

    const hasNext = Boolean(message.hasNext);

    if (session.currentPage < session.maxPages && hasNext) {
      session.currentPage += 1;
      chrome.tabs.sendMessage(tabId, { type: "GO_NEXT_PAGE" });
    } else {
      const finalRows = Array.from(session.rowsMap.values());
      downloadCsv(finalRows);
      chrome.tabs.sendMessage(tabId, {
        type: "SCRAPE_DONE",
        total: finalRows.length,
        pages: session.currentPage
      });
      sessions.delete(tabId);
    }
  }
});

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status !== "complete") return;
  if (!sessions.has(tabId)) return;
  if (!tab.url || !/^https:\/\/www\.google\.com\/search\?/.test(tab.url)) return;

  chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"]
  }).catch(err => console.error("Injection failed:", err));
});

chrome.tabs.onRemoved.addListener((tabId) => {
  sessions.delete(tabId);
});

function mergePipeValues(a = "", b = "") {
  const set = new Set();
  String(a).split("|").map(s => s.trim()).filter(Boolean).forEach(v => set.add(v));
  String(b).split("|").map(s => s.trim()).filter(Boolean).forEach(v => set.add(v));
  return Array.from(set).join(" | ");
}

function escapeCsv(value) {
  const str = String(value ?? "");
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function downloadCsv(rows) {
  const header = ["Name", "Headline", "LinkedIn URL", "Email", "Phone Number"];
  const lines = [header.join(",")];

  for (const r of rows) {
    lines.push([
      escapeCsv(r.name),
      escapeCsv(r.headline),
      escapeCsv(r.url),
      escapeCsv(r.email),
      escapeCsv(r.phone)
    ].join(","));
  }

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const blobUrl = URL.createObjectURL(blob);
  const filename = `linkedin_leads_multi_${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;

  chrome.downloads.download({
    url: blobUrl,
    filename,
    saveAs: false
  }, () => {
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
  });
}