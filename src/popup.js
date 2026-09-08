const statusEl = document.getElementById('status');
const coverBtn = document.getElementById('cover');

document.getElementById('options').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
  window.close();
});

(async () => {
  // Not lastFocusedWindow: inside a popup, the popup IS the last focused window.
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const { profiles } = await chrome.storage.local.get({ profiles: [] });
  const match = pickProfileForUrl((profiles || []).map(normalizeProfile), (tab && tab.url) || '');

  if (!match) {
    statusEl.textContent = 'No profile covers this page.';
    return;
  }
  statusEl.textContent = 'Covered by "' + match.name + '".';
  coverBtn.disabled = false;
  coverBtn.addEventListener('click', () => {
    chrome.tabs.sendMessage(tab.id, { type: 'toggle-cover' }).catch(() => {});
    window.close();
  });
})();
