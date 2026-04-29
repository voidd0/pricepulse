// pricepulse popup — quick-add + status meter + recent alerts feed.
//
// Build pipeline prepends shared/{constants,browser,install_id}.js so
// PP_CONFIG, PP_API, PP_getInstallId are global. The popup also gets
// re-loaded on every open, so caching is server-side, not in popup memory.

const $ = (id) => document.getElementById(id);

function looksLikePricingUrl(url, title) {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return false;
    const path = (u.pathname + ' ' + (u.hash || '')).toLowerCase();
    if (/\/pricing|\/plans|\/price\b|\/buy\b|\/upgrade\b/.test(path)) return true;
    if (title && /\b(pricing|plans|price|tariff)\b/i.test(title)) return true;
  } catch { return false; }
  return false;
}

function timeAgo(iso) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.max(1, Math.floor(ms / 1000));
  if (s < 60) return s + 's ago';
  const m = Math.floor(s / 60);
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  const d = Math.floor(h / 24);
  return d + 'd ago';
}

function setBadge(plan) {
  const el = $('plan-badge');
  el.classList.remove('badge-free', 'badge-pro', 'badge-pro_plus');
  el.classList.add('badge-' + plan);
  el.textContent = plan === 'pro_plus' ? 'PRO+' : plan.toUpperCase();
}

function setMeter(used, limit) {
  $('meter-val').textContent = used + ' / ' + limit;
  const pct = Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  $('meter-fill').style.width = pct + '%';
}

function setCadence(plan) {
  const cad =
    plan === 'pro_plus' ? PP_CONFIG.PROPLUS_CHECK_INTERVAL_LABEL :
    plan === 'pro'      ? PP_CONFIG.PRO_CHECK_INTERVAL_LABEL :
                          PP_CONFIG.FREE_CHECK_INTERVAL_LABEL;
  $('check-cadence').textContent = 'checks ' + cad;
}

function renderRecent(items) {
  const list = $('recent-list');
  list.replaceChildren();
  if (!items || items.length === 0) {
    const li = document.createElement('li');
    li.className = 'recent-empty';
    li.textContent = 'nothing changed yet — alerts show up here when a watched page changes.';
    list.append(li);
    return;
  }
  // Sort by last_checked_at desc, then take last 5 with a diff_summary.
  const recent = items
    .filter((w) => w.last_diff_summary)
    .sort((a, b) => (b.last_checked_at || '').localeCompare(a.last_checked_at || ''))
    .slice(0, 5);
  if (recent.length === 0) {
    const li = document.createElement('li');
    li.className = 'recent-empty';
    li.textContent = 'no alerts in your recent history.';
    list.append(li);
    return;
  }
  for (const w of recent) {
    const li = document.createElement('li');
    li.className = 'alert';
    let host = '';
    try { host = new URL(w.url).host; } catch { host = w.url; }
    const hostEl = document.createElement('div');
    hostEl.className = 'alert-host';
    hostEl.textContent = host;
    const sumEl = document.createElement('div');
    sumEl.className = 'alert-summary';
    sumEl.textContent = w.last_diff_summary;
    const whenEl = document.createElement('div');
    whenEl.className = 'alert-when';
    whenEl.textContent = timeAgo(w.last_checked_at);
    li.append(hostEl, sumEl, whenEl);
    list.append(li);
  }
}

async function loadStatus() {
  const resp = await PP_API.runtime.sendMessage({ kind: 'get-status' });
  if (!resp || !resp.ok) return;
  setBadge(resp.plan);
  setMeter((resp.watchlist || []).length, resp.limit);
  setCadence(resp.plan);
  renderRecent(resp.watchlist);
  return resp;
}

async function init() {
  await loadStatus();

  const tabs = await PP_API.tabs.query({ active: true, currentWindow: true });
  const cur = tabs && tabs[0];
  const url = cur && cur.url;
  const title = cur && cur.title;
  const ok = looksLikePricingUrl(url, title);
  $('add-current').disabled = !ok;
  if (ok) {
    $('add-current-label').textContent = '+ add this page to watchlist';
    $('add-current-hint').textContent = 'we will start checking this URL on your tier schedule';
  } else {
    $('add-current-label').textContent = '+ add to watchlist';
    $('add-current-hint').textContent = 'open a competitor pricing or plans page first';
  }

  $('add-current').addEventListener('click', async () => {
    const tabs = await PP_API.tabs.query({ active: true, currentWindow: true });
    const cur = tabs && tabs[0];
    if (!cur || !cur.url) return;
    $('add-current').disabled = true;
    $('add-current-label').textContent = 'adding...';
    const resp = await PP_API.runtime.sendMessage({
      kind: 'add-watchlist',
      url: cur.url,
      nickname: (cur.title || '').slice(0, 80),
    });
    if (resp && resp.ok) {
      $('add-current-label').textContent = '✓ added';
      setTimeout(() => loadStatus().then(() => {
        $('add-current').disabled = !looksLikePricingUrl(cur.url, cur.title);
        $('add-current-label').textContent = '+ add this page to watchlist';
      }), 1200);
    } else {
      $('add-current').disabled = false;
      const reason = resp && resp.error && (resp.error.detail || resp.error.error) || 'unknown error';
      $('add-current-label').textContent = '+ add to watchlist';
      $('add-current-hint').textContent = 'add failed: ' + String(reason).slice(0, 60);
    }
  });

  $('refresh').addEventListener('click', loadStatus);
  $('open-app').addEventListener('click', () => PP_API.runtime.sendMessage({ kind: 'open-app' }));
  $('open-options').addEventListener('click', () => PP_API.runtime.sendMessage({ kind: 'open-options' }));
  $('open-upgrade').addEventListener('click', () => PP_API.runtime.sendMessage({ kind: 'open-upgrade' }));
}

// Pull in shared bootstrap (build script will inline these into popup.html via <script>).
// In the dist tree popup loads shared/* via <script> tags before this file.
init();
