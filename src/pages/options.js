// pricepulse options — watchlist editor + alert prefs + license entry.

const $ = (id) => document.getElementById(id);

function setStatus(el, msg, kind) {
  el.textContent = msg;
  el.classList.remove('ok', 'err');
  if (kind) el.classList.add(kind);
}

function fmtAgo(iso) {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.max(1, Math.floor(ms / 1000));
  if (s < 60)  return s + 's ago';
  const m = Math.floor(s / 60);
  if (m < 60)  return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24)  return h + 'h ago';
  const d = Math.floor(h / 24);
  return d + 'd ago';
}

function setPlanBadge(plan) {
  const el = $('plan-badge');
  el.classList.remove('badge-free', 'badge-pro', 'badge-pro_plus');
  el.classList.add('badge-' + plan);
  el.textContent = plan === 'pro_plus' ? 'PRO+' : plan.toUpperCase();
}

async function refreshWatchlist() {
  const resp = await PP_API.runtime.sendMessage({ kind: 'get-status' });
  const body = $('watchlist-body');
  body.replaceChildren();
  if (!resp || !resp.ok) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 4; td.className = 'empty';
    td.textContent = 'could not load watchlist (' + (resp && resp.error || 'network') + ')';
    tr.append(td); body.append(tr);
    return;
  }
  setPlanBadge(resp.plan);
  const items = resp.watchlist || [];
  if (items.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 4; td.className = 'empty';
    td.textContent = 'no watchlist entries yet — add one above or click the toolbar icon on a competitor pricing page.';
    tr.append(td); body.append(tr);
    return;
  }
  for (const w of items) {
    const tr = document.createElement('tr');

    const tdUrl = document.createElement('td');
    if (w.nickname) {
      const nick = document.createElement('div');
      nick.className = 'wl-nick'; nick.textContent = w.nickname;
      tdUrl.append(nick);
    }
    const url = document.createElement('div');
    url.className = 'wl-url'; url.textContent = w.url;
    tdUrl.append(url);
    tr.append(tdUrl);

    const tdWhen = document.createElement('td');
    tdWhen.className = 'wl-when';
    tdWhen.textContent = fmtAgo(w.last_checked_at);
    tr.append(tdWhen);

    const tdSummary = document.createElement('td');
    if (w.last_diff_summary) {
      tdSummary.className = 'wl-summary';
      tdSummary.textContent = w.last_diff_summary;
    } else {
      tdSummary.className = 'wl-summary no-change';
      tdSummary.textContent = 'no change since last check';
    }
    tr.append(tdSummary);

    const tdActions = document.createElement('td');
    const actions = document.createElement('div');
    actions.className = 'wl-actions';
    const view = document.createElement('button');
    view.className = 'btn ghost'; view.textContent = 'history';
    view.addEventListener('click', () => {
      window.open('app.html?watchlist=' + encodeURIComponent(w.id) + '#history', '_blank');
    });
    const del = document.createElement('button');
    del.className = 'btn danger'; del.textContent = 'remove';
    del.addEventListener('click', async () => {
      if (!confirm('remove this entry from your watchlist? snapshot history will also be deleted.')) return;
      const r = await PP_API.runtime.sendMessage({ kind: 'remove-watchlist', id: w.id });
      if (r && r.ok) refreshWatchlist();
      else alert('could not remove: ' + (r && r.error && (r.error.detail || r.error.error) || 'unknown'));
    });
    actions.append(view, del);
    tdActions.append(actions);
    tr.append(tdActions);

    body.append(tr);
  }
}

async function loadSavedPrefs() {
  const data = await PP_API.storage.sync.get([
    'pricepulseAlertEmail',
    'pricepulseAlertWebhook',
    'pricepulseLicenseKey',
  ]);
  $('alert-email').value = data.pricepulseAlertEmail || '';
  $('alert-webhook').value = data.pricepulseAlertWebhook || '';
  $('lic-key').value = data.pricepulseLicenseKey || '';
}

async function saveAlerts() {
  const email = $('alert-email').value.trim();
  const webhook = $('alert-webhook').value.trim();
  const status = $('alert-status');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setStatus(status, 'invalid email format.', 'err');
    return;
  }
  if (webhook && !/^https?:\/\//.test(webhook)) {
    setStatus(status, 'webhook must be a https URL.', 'err');
    return;
  }
  await PP_API.storage.sync.set({
    pricepulseAlertEmail: email,
    pricepulseAlertWebhook: webhook,
  });
  setStatus(status, 'saved locally. server sync on next watchlist update.', 'ok');
}

async function saveLicense() {
  const key = $('lic-key').value.trim();
  const status = $('license-status');
  if (!key) { setStatus(status, 'paste a license key first.', 'err'); return; }
  await PP_API.storage.sync.set({ pricepulseLicenseKey: key });
  setStatus(status, 'verifying with server...', '');
  const r = await PP_API.runtime.sendMessage({ kind: 'check-license' });
  if (r && r.ok && (r.plan === 'pro' || r.plan === 'pro_plus')) {
    setStatus(status, 'activated · ' + (r.plan === 'pro_plus' ? 'Pro+' : 'Pro'), 'ok');
    setPlanBadge(r.plan);
  } else {
    setStatus(status, 'key not recognized — check the email after checkout, or contact support@voiddo.com.', 'err');
  }
}

async function forgetLicense() {
  await PP_API.runtime.sendMessage({ kind: 'forget-license' });
  $('lic-key').value = '';
  setPlanBadge('free');
  setStatus($('license-status'), 'license forgotten on this device.', 'ok');
}

async function exportCsv() {
  const status = $('export-status');
  setStatus(status, 'building CSV...', '');
  const resp = await PP_API.runtime.sendMessage({ kind: 'get-status' });
  if (!resp || !resp.ok || resp.plan === 'free') {
    setStatus(status, 'CSV export is a Pro / Pro+ feature.', 'err');
    return;
  }
  const items = resp.watchlist || [];
  const header = 'id,url,nickname,last_checked_at,last_diff_summary\n';
  const rows = items.map((w) =>
    [w.id, w.url, w.nickname || '', w.last_checked_at || '', w.last_diff_summary || '']
      .map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(',')
  ).join('\n');
  const csv = header + rows + '\n';
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'pricepulse-watchlist-' + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  setStatus(status, 'exported.', 'ok');
}

async function init() {
  await loadSavedPrefs();
  await refreshWatchlist();

  $('add-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = $('add-url').value.trim();
    const nick = $('add-nick').value.trim();
    if (!url) return;
    const status = $('add-status');
    setStatus(status, 'adding...', '');
    const r = await PP_API.runtime.sendMessage({
      kind: 'add-watchlist', url, nickname: nick,
    });
    if (r && r.ok) {
      $('add-url').value = ''; $('add-nick').value = '';
      setStatus(status, 'added.', 'ok');
      refreshWatchlist();
    } else {
      const reason = r && r.error && (r.error.detail || r.error.error) || 'network error';
      setStatus(status, 'add failed: ' + String(reason), 'err');
    }
  });

  $('save-alerts').addEventListener('click', saveAlerts);
  $('save-license').addEventListener('click', saveLicense);
  $('forget-license').addEventListener('click', forgetLicense);
  $('export-csv').addEventListener('click', exportCsv);
}

init();
