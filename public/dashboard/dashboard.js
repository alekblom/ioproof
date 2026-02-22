// Shared dashboard utilities

async function fetchAPI(url, options = {}) {
  const res = await fetch(url, options);
  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('Not authenticated');
  }
  return res;
}

function timeAgo(dateStr) {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function truncHash(hash, len = 12) {
  if (!hash) return '';
  return hash.substring(0, len) + '...';
}

function renderUsageMeter(container, used, limit) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  let cls = '';
  if (pct >= 90) cls = 'danger';
  else if (pct >= 70) cls = 'warning';

  container.innerHTML = `
    <div class="meter-label">
      <span>${used} / ${limit} proofs</span>
      <span>${pct}%</span>
    </div>
    <div class="meter-bar">
      <div class="meter-fill ${cls}" style="width:${pct}%"></div>
    </div>
  `;
}

function showKeyModal(fullKey) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h3>API Key Created</h3>
      <p class="modal-warning">This is the only time the full key will be shown. Copy and store it securely.</p>
      <div class="key-display">${fullKey}</div>
      <div class="modal-actions">
        <button class="btn-primary" id="copy-key">Copy Key</button>
        <button class="btn-primary" id="close-modal" style="background:#333;">Done</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('copy-key').addEventListener('click', () => {
    navigator.clipboard.writeText(fullKey);
    document.getElementById('copy-key').textContent = 'Copied!';
  });
  document.getElementById('close-modal').addEventListener('click', () => {
    overlay.remove();
    if (typeof loadKeys === 'function') loadKeys();
  });
}

// Set active nav link
function setActiveNav() {
  const path = window.location.pathname;
  document.querySelectorAll('.dash-sidebar a').forEach((a) => {
    const href = a.getAttribute('href');
    if (path === href || (href !== '/dashboard' && path.startsWith(href))) {
      a.classList.add('active');
    }
  });
}

// Load user info for header
async function loadDashboardHeader() {
  try {
    const res = await fetchAPI('/auth/me');
    const user = await res.json();
    const emailEl = document.getElementById('user-email');
    if (emailEl) emailEl.textContent = user.email;
  } catch { /* redirect handled by fetchAPI */ }
}

// Logout
function setupLogout() {
  const btn = document.getElementById('logout-btn');
  if (btn) {
    btn.addEventListener('click', async () => {
      await fetch('/auth/logout', { method: 'POST' });
      window.location.href = '/login';
    });
  }
}

// Init common
document.addEventListener('DOMContentLoaded', () => {
  setActiveNav();
  loadDashboardHeader();
  setupLogout();
});
