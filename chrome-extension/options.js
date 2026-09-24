const fields = ["apiUrl", "token", "connectionReviewDays", "maxPerSession", "locale"];

async function load() {
  const stored = await chrome.storage.sync.get(fields);
  for (const id of fields) {
    const el = document.getElementById(id);
    if (el && stored[id] !== undefined) el.value = stored[id];
  }
  if (!document.getElementById("apiUrl").value) {
    document.getElementById("apiUrl").value = "http://localhost:9006";
  }
}

document.getElementById("save").addEventListener("click", async () => {
  const payload = {};
  for (const id of fields) {
    payload[id] = document.getElementById(id).value;
  }
  await chrome.storage.sync.set(payload);
  const saved = document.getElementById("saved");
  saved.classList.remove("hidden");
  setTimeout(() => saved.classList.add("hidden"), 2000);
});

document.getElementById("reset-session").addEventListener("click", async () => {
  await chrome.storage.sync.set({ sessionCount: 0 });
});

load();
