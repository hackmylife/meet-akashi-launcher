const MESSAGE_TYPES = {
  GET_SETTINGS: 'GET_SETTINGS',
  UPDATE_SETTINGS: 'UPDATE_SETTINGS',
  LOGIN: 'LOGIN',
};

document.addEventListener('DOMContentLoaded', async () => {
  const akashiUrlInput = document.getElementById('akashiUrl');
  const notifyAkashiCheckbox = document.getElementById('notifyAkashi');
  const autoOpenMeetCheckbox = document.getElementById('autoOpenMeet');
  const meetOpenTimingInput = document.getElementById('meetOpenTiming');
  const meetWindowWidthInput = document.getElementById('meetWindowWidth');
  const meetWindowHeightInput = document.getElementById('meetWindowHeight');
  const saveBtn = document.getElementById('saveBtn');
  const saveStatus = document.getElementById('saveStatus');
  const connectBtn = document.getElementById('connectBtn');
  const accountBadge = document.getElementById('accountBadge');

  // Load current settings
  try {
    const resp = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_SETTINGS });
    if (resp && resp.settings) {
      populateForm(resp.settings);
    }
  } catch (err) {
    console.error('Failed to load settings:', err);
  }

  // Check Google auth status via storage
  chrome.storage.local.get(['oauth_access_token', 'oauth_token_expiry'], (data) => {
    if (data.oauth_access_token && Date.now() < (data.oauth_token_expiry || 0)) {
      accountBadge.textContent = '接続済み';
      accountBadge.className = 'status-badge status-badge-success';
      connectBtn.textContent = '再接続';
    } else {
      accountBadge.textContent = '未接続';
      accountBadge.className = 'status-badge status-badge-warning';
    }
  });

  // Connect Google via launchWebAuthFlow
  connectBtn.addEventListener('click', () => {
    connectBtn.disabled = true;
    connectBtn.textContent = '接続中...';
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.LOGIN }, (resp) => {
      connectBtn.disabled = false;
      if (chrome.runtime.lastError || (resp && resp.error)) {
        console.error('Auth failed:', chrome.runtime.lastError?.message || resp?.error);
        connectBtn.textContent = 'Google に接続';
        return;
      }
      accountBadge.textContent = '接続済み';
      accountBadge.className = 'status-badge status-badge-success';
      connectBtn.textContent = '再接続';
    });
  });

  // Save settings
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    saveStatus.textContent = '';

    // Validate Akashi URL (HTTPS + *.ak4.jp only)
    let akashiUrl = akashiUrlInput.value.trim() || 'https://atnd.ak4.jp';
    try {
      const parsed = new URL(akashiUrl);
      if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.ak4.jp')) {
        saveStatus.textContent = 'Akashi URLが不正です（https://*.ak4.jpのみ）';
        saveStatus.style.color = '#ea4335';
        saveBtn.disabled = false;
        return;
      }
      akashiUrl = parsed.origin;
    } catch {
      saveStatus.textContent = 'Akashi URLの形式が不正です';
      saveStatus.style.color = '#ea4335';
      saveBtn.disabled = false;
      return;
    }

    const settings = {
      akashiUrl,
      notifyAkashi: notifyAkashiCheckbox.checked,
      autoOpenMeet: autoOpenMeetCheckbox.checked,
      meetOpenTiming: parseInt(meetOpenTimingInput.value, 10) || 60,
      meetWindowWidth: parseInt(meetWindowWidthInput.value, 10) || 1280,
      meetWindowHeight: parseInt(meetWindowHeightInput.value, 10) || 800,
    };

    try {
      await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.UPDATE_SETTINGS,
        settings,
      });
      saveStatus.textContent = '保存しました';
      setTimeout(() => { saveStatus.textContent = ''; }, 3000);
    } catch (err) {
      console.error('Failed to save settings:', err);
      saveStatus.textContent = '保存に失敗しました';
      saveStatus.style.color = '#ea4335';
    } finally {
      saveBtn.disabled = false;
    }
  });

  function populateForm(settings) {
    akashiUrlInput.value = settings.akashiUrl || 'https://atnd.ak4.jp';
    notifyAkashiCheckbox.checked = settings.notifyAkashi !== false;
    autoOpenMeetCheckbox.checked = settings.autoOpenMeet !== false;
    meetOpenTimingInput.value = settings.meetOpenTiming || 60;
    meetWindowWidthInput.value = settings.meetWindowWidth || 1280;
    meetWindowHeightInput.value = settings.meetWindowHeight || 800;
  }
});
