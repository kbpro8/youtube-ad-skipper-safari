const api = typeof browser !== "undefined" ? browser : chrome;
const toggle = document.getElementById("enabled");
const count = document.getElementById("count");
const reset = document.getElementById("reset");

function render(s) {
  if ("enabled" in s) toggle.checked = s.enabled !== false;
  if ("skipped" in s) count.textContent = (s.skipped || 0).toLocaleString();
}

api.storage.local.get({ enabled: true, skipped: 0 }).then(render);

api.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  const s = {};
  for (const k in changes) s[k] = changes[k].newValue;
  render(s);
});

toggle.addEventListener("change", () => api.storage.local.set({ enabled: toggle.checked }));
reset.addEventListener("click", () => api.storage.local.set({ skipped: 0 }));
