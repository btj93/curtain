document.getElementById('grant').addEventListener('click', async () => {
  const origin = document.getElementById('origin').value.trim();
  try {
    const ok = await chrome.permissions.request({ origins: [origin + '/*'] });
    document.getElementById('out').textContent = ok ? 'Granted' : 'Denied';
  } catch (e) {
    document.getElementById('out').textContent = String(e.message || e);
  }
});
