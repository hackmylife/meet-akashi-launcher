const MESSAGE_TYPES = {
  GET_STATUS: 'GET_STATUS',
  REFRESH_CALENDAR: 'REFRESH_CALENDAR',
  LOGIN: 'LOGIN',
  SKIP_MEETING: 'SKIP_MEETING',
  UNSKIP_MEETING: 'UNSKIP_MEETING',
};

document.addEventListener('DOMContentLoaded', () => {
  const statusSection = document.getElementById('attendanceStatus');
  const statusIcon = document.getElementById('statusIcon');
  const statusTitle = document.getElementById('statusTitle');
  const statusSubtitle = document.getElementById('statusSubtitle');
  const statusAction = document.getElementById('statusAction');
  const meetingsList = document.getElementById('meetingsList');
  const refreshBtn = document.getElementById('refreshBtn');
  const loginBtn = document.getElementById('loginBtn');
  const settingsLink = document.getElementById('settingsLink');
  const fabPunch = document.getElementById('fabPunch');

  // Open settings page
  settingsLink.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Google login via Service Worker (launchWebAuthFlow)
  loginBtn.addEventListener('click', () => {
    loginBtn.textContent = 'ログイン中...';
    loginBtn.disabled = true;
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.LOGIN }, (resp) => {
      if (chrome.runtime.lastError) {
        console.error('Login failed:', chrome.runtime.lastError.message);
        loginBtn.textContent = 'Google ログイン';
        loginBtn.disabled = false;
        return;
      }
      if (resp && resp.error) {
        console.error('Login failed:', resp.error);
        loginBtn.textContent = 'Google ログイン';
        loginBtn.disabled = false;
        return;
      }
      loginBtn.textContent = 'ログイン済み';
      loadData();
    });
  });

  // Refresh button
  refreshBtn.addEventListener('click', () => {
    refreshBtn.disabled = true;
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.REFRESH_CALENDAR }, (resp) => {
      if (resp && resp.events) {
        renderMeetings(resp.events);
      }
      refreshBtn.disabled = false;
    });
  });

  // Initial load
  loadData();

  let currentSkipped = [];
  let currentSettings = {};

  function loadData() {
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_STATUS }, (resp) => {
      if (chrome.runtime.lastError) {
        console.error('Failed to load status:', chrome.runtime.lastError.message);
        return;
      }
      if (!resp) return;
      currentSettings = resp.settings || {};

      currentSkipped = resp.skippedMeetings || [];
      if (currentSettings.enableAkashi !== false) {
        statusSection.style.display = '';
        renderAkashiStatus(resp.akashiStatus);
      } else {
        statusSection.style.display = 'none';
        fabPunch.style.display = 'none';
      }
      renderMeetings(resp.events || []);
    });
  }

  function renderAkashiStatus(akashiStatus) {
    statusSection.className = 'status-section';
    statusAction.innerHTML = '';
    fabPunch.style.display = 'none';
    const punchUrl = (currentSettings.akashiUrl || 'https://atnd.ak4.jp') + '/ja/mypage/punch';

    if (!akashiStatus || akashiStatus.status === 'UNKNOWN') {
      statusSection.classList.add('status-unknown');
      statusIcon.textContent = '-';
      statusTitle.textContent = '状態不明';
      statusSubtitle.textContent = 'Akashiのタブを開いてください';
    } else if (akashiStatus.status === 'CLOCKED_OUT') {
      statusSection.classList.add('status-success');
      statusIcon.textContent = '\u2713';
      statusTitle.textContent = '退勤済み';
      statusSubtitle.textContent = 'お疲れ様でした！';
    } else if (akashiStatus.status === 'CLOCKED_IN') {
      statusSection.classList.add('status-success');
      statusIcon.textContent = '\u2713';
      statusTitle.textContent = '出勤済み';
      statusSubtitle.textContent = '今日も一日頑張りましょう！';
    } else if (akashiStatus.status === 'NOT_CLOCKED_OUT') {
      const now = new Date();
      const isUrgent = now.getHours() > 21 || (now.getHours() === 21 && now.getMinutes() >= 55);
      if (isUrgent) {
        statusSection.classList.add('status-danger');
        statusIcon.textContent = '!';
        statusTitle.textContent = '退勤打刻が必要です！';
        statusSubtitle.textContent = '21:55を過ぎています。すぐに退勤打刻をしてください！';
      } else {
        statusSection.classList.add('status-warning');
        statusIcon.textContent = '!';
        statusTitle.textContent = '退勤未打刻';
        statusSubtitle.textContent = '退勤打刻を忘れていませんか？';
      }
      statusAction.innerHTML = `<a href="${punchUrl}" target="_blank" class="btn btn-primary btn-sm status-punch-link">退勤する</a>`;
      fabPunch.innerHTML = `<a href="${punchUrl}" target="_blank">退勤する</a>`;
      fabPunch.style.display = '';
    } else if (akashiStatus.status === 'NOT_CLOCKED_IN') {
      statusSection.classList.add('status-danger');
      statusIcon.textContent = '!';
      statusTitle.textContent = '未出勤';
      statusSubtitle.textContent = '出勤打刻を忘れていませんか？';
      statusAction.innerHTML = `<a href="${punchUrl}" target="_blank" class="btn btn-primary btn-sm status-punch-link">出勤する</a>`;
      fabPunch.innerHTML = `<a href="${punchUrl}" target="_blank">出勤する</a>`;
      fabPunch.style.display = '';
    }
  }

  function renderMeetings(events) {
    const now = Date.now();
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // Filter to today's events
    const todayEvents = events.filter((e) => {
      if (!e.start) return false;
      return e.start.startsWith(todayStr);
    });

    if (todayEvents.length === 0) {
      meetingsList.innerHTML = '<div class="empty-state"><div class="empty-text">今日の会議はありません</div></div>';
      return;
    }

    // Find the next upcoming non-skipped meeting
    let nextEventId = null;
    for (const e of todayEvents) {
      if (currentSkipped.includes(e.id)) continue;
      const startMs = new Date(e.start).getTime();
      if (startMs > now) {
        nextEventId = e.id;
        break;
      }
    }

    meetingsList.innerHTML = '';

    for (const event of todayEvents) {
      const startMs = new Date(event.start).getTime();
      const endMs = event.end ? new Date(event.end).getTime() : startMs;
      const isPast = endMs < now;
      const isSkipped = currentSkipped.includes(event.id);
      const isNext = !isSkipped && event.id === nextEventId;

      const card = document.createElement('div');
      card.className = 'meeting-card';
      if (isPast) card.classList.add('meeting-past');
      if (isSkipped) card.classList.add('meeting-skipped');
      if (isNext) card.classList.add('meeting-next');

      const startTime = formatTime(event.start);
      const endTime = event.end ? formatTime(event.end) : '';

      let html = '';
      if (isNext) {
        html += '<span class="meeting-badge">次の会議</span>';
      }
      if (isSkipped) {
        html += '<span class="meeting-badge meeting-badge-skip">スキップ</span>';
      }
      html += `<div class="meeting-time">${startTime}${endTime ? ' - ' + endTime : ''}</div>`;
      html += `<div class="meeting-title">${escapeHtml(event.summary)}</div>`;

      if (!isPast) {
        html += '<div class="meeting-actions">';
        if (isSkipped) {
          html += `<button class="btn btn-secondary btn-sm" data-unskip="${escapeHtml(event.id)}">戻す</button>`;
        } else {
          if (event.meetUrl) {
            html += `<button class="btn btn-primary btn-sm" data-url="${escapeHtml(event.meetUrl)}">参加する</button>`;
          }
          html += `<button class="btn btn-secondary btn-sm" data-skip="${escapeHtml(event.id)}">スキップ</button>`;
        }
        html += '</div>';
      }

      card.innerHTML = html;
      meetingsList.appendChild(card);
    }

    // Auto-scroll so the next meeting is visible with context above
    const nextCard = meetingsList.querySelector('.meeting-next');
    if (nextCard) {
      // Use previous sibling as scroll target to show context above the next card
      const scrollTarget = nextCard.previousElementSibling || nextCard;
      requestAnimationFrame(() => {
        scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    // Click handler (join / skip / unskip)
    meetingsList.addEventListener('click', (e) => {
      const joinBtn = e.target.closest('button[data-url]');
      if (joinBtn) {
        const url = joinBtn.getAttribute('data-url');
        // Meet URL のドメイン検証
        try {
          const parsed = new URL(url);
          if (parsed.protocol !== 'https:' || parsed.hostname !== 'meet.google.com') {
            console.error('[Popup] Invalid Meet URL blocked:', url);
            return;
          }
        } catch {
          console.error('[Popup] Malformed URL blocked:', url);
          return;
        }
        chrome.windows.create({
          url,
          type: 'normal',
          focused: true,
          width: currentSettings.meetWindowWidth || 1280,
          height: currentSettings.meetWindowHeight || 800,
        });
        return;
      }

      const skipBtn = e.target.closest('button[data-skip]');
      if (skipBtn) {
        const eventId = skipBtn.getAttribute('data-skip');
        chrome.runtime.sendMessage({ type: MESSAGE_TYPES.SKIP_MEETING, eventId }, () => {
          currentSkipped.push(eventId);
          renderMeetings(events);
        });
        return;
      }

      const unskipBtn = e.target.closest('button[data-unskip]');
      if (unskipBtn) {
        const eventId = unskipBtn.getAttribute('data-unskip');
        chrome.runtime.sendMessage({ type: MESSAGE_TYPES.UNSKIP_MEETING, eventId }, () => {
          currentSkipped = currentSkipped.filter((id) => id !== eventId);
          renderMeetings(events);
        });
      }
    });
  }

  function formatTime(dateString) {
    const d = new Date(dateString);
    return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
});
