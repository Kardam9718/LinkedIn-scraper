document.getElementById("generateBtn").addEventListener("click", () => {
  const jobTitle = document.getElementById("jobTitle").value.trim();
  const location = document.getElementById("location").value.trim();
  let maxPages = parseInt(document.getElementById("maxPages").value, 10);

  if (!jobTitle || !location) {
    alert("Please enter both Job Title and Location.");
    return;
  }

  if (Number.isNaN(maxPages) || maxPages < 1) maxPages = 1;
  if (maxPages > 20) maxPages = 20;

  const query = `site:linkedin.com/in "${jobTitle}" "${location}" ("@gmail.com" OR "+91" OR "WhatsApp")`;
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

  chrome.runtime.sendMessage({
    type: "OPEN_SEARCH_TAB",
    url,
    maxPages
  });

  window.close();
});