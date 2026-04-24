(() => {
  if (window.__linkedinLeadExtractorV2) return;
  window.__linkedinLeadExtractorV2 = true;

  const emailRegex = /[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const phoneRegex = /(?:\+?\d{1,3}[-\s]?)?\(?\d{3}\)?[-\s]?\d{3}[-\s]?\d{4}/g;

  function parseCurrentPage() {
    const resultBlocks = Array.from(document.querySelectorAll("div.g"));
    const rows = [];

    for (const block of resultBlocks) {
      const linkEl = block.querySelector("a[href]");
      const titleEl = block.querySelector("h3");
      if (!linkEl || !titleEl) continue;

      const rawUrl = linkEl.href || "";
      if (!/linkedin\.com\/in\//i.test(rawUrl)) continue;

      const snippetEl =
        block.querySelector(".VwiC3b") ||
        block.querySelector(".IsZvec") ||
        block.querySelector("[data-sncf]");

      const snippetText = snippetEl ? snippetEl.innerText : "";
      const titleText = titleEl.innerText.trim();

      const cleaned = titleText.replace(/\s*\|\s*LinkedIn\s*$/i, "").trim();

      let name = "";
      let headline = "";

      if (cleaned.includes(" - ")) {
        const parts = cleaned.split(" - ");
        name = (parts[0] || "").trim();
        headline = parts.slice(1).join(" - ").trim();
      } else if (cleaned.includes(" | ")) {
        const parts = cleaned.split(" | ");
        name = (parts[0] || "").trim();
        headline = parts.slice(1).join(" | ").trim();
      } else {
        name = cleaned;
      }

      const fullText = `${titleText}\n${snippetText}`;
      const emails = [...new Set((fullText.match(emailRegex) || []).map(x => x.trim()))];
      const phones = [...new Set((fullText.match(phoneRegex) || []).map(x => x.trim()))];

      rows.push({
        name,
        headline,
        url: rawUrl,
        email: emails.join(" | "),
        phone: phones.join(" | ")
      });
    }

    const nextBtn = document.querySelector("a#pnnext");
    return { rows, hasNext: !!nextBtn };
  }

  function sendPageData() {
    const payload = parseCurrentPage();
    chrome.runtime.sendMessage({
      type: "PAGE_DATA",
      rows: payload.rows,
      hasNext: payload.hasNext
    });
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "GO_NEXT_PAGE") {
      const nextBtn = document.querySelector("a#pnnext");
      if (nextBtn) {
        nextBtn.click();
      } else {
        chrome.runtime.sendMessage({ type: "PAGE_DATA", rows: [], hasNext: false });
      }
    }

    if (msg.type === "SCRAPE_DONE") {
      alert(`Done! Extracted ${msg.total} unique leads across ${msg.pages} page(s). CSV downloaded.`);
    }
  });

  // initial extraction on page load
  sendPageData();
})();