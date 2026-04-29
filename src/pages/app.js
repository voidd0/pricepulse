// pricepulse full-page app — 3 tabs: watchlist / diff viewer / history.
//
// Diff is computed server-side and returned as token-level [op, text] pairs;
// we render two columns highlighting added/removed text. The history graph
// is a thin SVG sparkline of (snapshot_time, has_change ? 1 : 0).

const $ = (id) => document.getElementById(id);

let WATCHLIST = [];
let CURRENT_PLAN = 'free';

function setPlanBadge(plan) {
  const el = $('plan-badge');
  el.classList.remove('badge-free', 'badge-pro', 'badge-pro_plus');
  el.classList.add('badge-' + plan);
  el.textContent = plan === 'pro_plus' ? 'PRO+' : plan.toUpperCase();
  CURRENT_PLAN = plan;
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
function fmtIso(iso) {
  if (!iso) return '—';
  return new Date(iso).toISOString().replace('T', ' ').slice(0, 16) + 'Z';
}

function setActiveTab(name) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.tab-pane').forEach((p) => p.classList.toggle('active', p.id === 'pane-' + name));
  if (location.hash !== '#' + name) history.replaceState(null, '', '#' + name);
}

// --- Watchlist tab -----------------------------------------------------------

function renderWatchlist() {
  const body = $('app-watchlist-body');
  body.replaceChildren();
  if (WATCHLIST.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 4; td.className = 'empty';
    td.textContent = 'no watchlist entries yet — click the toolbar icon on a competitor pricing page to add one.';
    tr.append(td); body.append(tr);
    return;
  }
  for (const w of WATCHLIST) {
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
    tdWhen.className = 'wl-when'; tdWhen.textContent = fmtAgo(w.last_checked_at);
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
    const histBtn = document.createElement('button');
    histBtn.className = 'btn ghost'; histBtn.textContent = 'history';
    histBtn.addEventListener('click', () => {
      $('hist-watchlist').value = w.id;
      setActiveTab('history');
      loadHistory(w.id);
    });
    const diffBtn = document.createElement('button');
    diffBtn.className = 'btn ghost'; diffBtn.textContent = 'diff';
    diffBtn.addEventListener('click', () => {
      $('diff-watchlist').value = w.id;
      setActiveTab('diff');
      onDiffWatchlistChange();
    });
    actions.append(histBtn, diffBtn);
    tdActions.append(actions);
    tr.append(tdActions);

    body.append(tr);
  }
}

// --- Snapshot dropdowns ------------------------------------------------------

let SNAPSHOTS_CACHE = {}; // { watchlistId: [ { id, captured_at, has_change } ] }

async function loadSnapshots(watchlistId) {
  if (!watchlistId) return [];
  if (SNAPSHOTS_CACHE[watchlistId]) return SNAPSHOTS_CACHE[watchlistId];
  const r = await PP_API.runtime.sendMessage({ kind: 'list-snapshots', watchlistId });
  if (!r || !r.ok) return [];
  const items = (r.data && r.data.items) || [];
  SNAPSHOTS_CACHE[watchlistId] = items;
  return items;
}

function fillSnapDropdown(select, snapshots, placeholder) {
  select.replaceChildren();
  const opt0 = document.createElement('option');
  opt0.value = ''; opt0.textContent = placeholder;
  select.append(opt0);
  for (const s of snapshots) {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = fmtIso(s.captured_at) + (s.has_change ? '  · changed' : '');
    select.append(opt);
  }
}

async function onDiffWatchlistChange() {
  const watchlistId = $('diff-watchlist').value;
  const snaps = await loadSnapshots(watchlistId);
  fillSnapDropdown($('diff-snap-a'), snaps, 'earlier snapshot');
  fillSnapDropdown($('diff-snap-b'), snaps, 'later snapshot');
  // Default: pick the second-most-recent and most-recent that have_change.
  const changed = snaps.filter((s) => s.has_change);
  if (changed.length >= 2) {
    $('diff-snap-a').value = changed[1].id;
    $('diff-snap-b').value = changed[0].id;
  }
}

async function loadDiff() {
  const a = $('diff-snap-a').value;
  const b = $('diff-snap-b').value;
  if (!a || !b) return;
  const r = await PP_API.runtime.sendMessage({ kind: 'get-diff', a, b });
  $('diff-empty').style.display = 'none';
  $('diff-grid').style.display = 'grid';
  const aPane = $('diff-a'); const bPane = $('diff-b');
  aPane.replaceChildren(); bPane.replaceChildren();
  if (!r || !r.ok) {
    aPane.textContent = 'could not load diff: ' + (r && r.error && (r.error.detail || r.error.error) || 'network');
    bPane.textContent = '';
    return;
  }
  $('diff-a-when').textContent = fmtIso(r.data.a_captured_at) + ' (earlier)';
  $('diff-b-when').textContent = fmtIso(r.data.b_captured_at) + ' (later)';
  // Render token list for each side: [{op:'eq'|'add'|'del', text:'...'}, ...]
  for (const tok of (r.data.left_tokens || [])) {
    const span = document.createElement('span');
    if (tok.op === 'del') span.className = 'removed';
    span.textContent = tok.text;
    aPane.append(span);
  }
  for (const tok of (r.data.right_tokens || [])) {
    const span = document.createElement('span');
    if (tok.op === 'add') span.className = 'added';
    span.textContent = tok.text;
    bPane.append(span);
  }
}

// --- History tab -------------------------------------------------------------

function renderHistoryGraph(snapshots) {
  const container = $('hist-graph');
  container.replaceChildren();
  if (snapshots.length === 0) {
    container.textContent = 'no snapshots yet.';
    return;
  }
  const W = 760, H = 80, pad = 12;
  const svgNs = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNs, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', '100%'); svg.setAttribute('height', H);

  const t0 = new Date(snapshots[snapshots.length - 1].captured_at).getTime();
  const t1 = new Date(snapshots[0].captured_at).getTime();
  const span = Math.max(1, t1 - t0);
  for (const s of snapshots) {
    const t = new Date(s.captured_at).getTime();
    const x = pad + ((t - t0) / span) * (W - pad * 2);
    const y = s.has_change ? pad + 8 : H - pad - 8;
    const c = document.createElementNS(svgNs, 'circle');
    c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', s.has_change ? 5 : 3);
    c.setAttribute('fill', s.has_change ? '#22d3ee' : '#94a3b8');
    if (s.has_change) c.setAttribute('opacity', '1'); else c.setAttribute('opacity', '0.6');
    svg.append(c);
  }
  // baseline
  const line = document.createElementNS(svgNs, 'line');
  line.setAttribute('x1', pad); line.setAttribute('y1', H / 2);
  line.setAttribute('x2', W - pad); line.setAttribute('y2', H / 2);
  line.setAttribute('stroke', 'rgba(255,255,255,.06)'); line.setAttribute('stroke-width', '1');
  svg.append(line);
  container.append(svg);
}

function renderHistoryEvents(snapshots) {
  const list = $('hist-events');
  list.replaceChildren();
  const events = snapshots.filter((s) => s.has_change).slice(0, 30);
  if (events.length === 0) {
    const li = document.createElement('li');
    const sum = document.createElement('span');
    sum.className = 'ev-summary';
    sum.textContent = 'no changes detected yet — page has been stable since first snapshot.';
    li.append(sum);
    list.append(li);
    return;
  }
  for (const s of events) {
    const li = document.createElement('li');
    const when = document.createElement('span');
    when.className = 'ev-when'; when.textContent = fmtIso(s.captured_at);
    const sum = document.createElement('span');
    sum.className = 'ev-summary ev-changed'; sum.textContent = s.diff_summary || 'page text changed';
    li.append(when, sum);
    list.append(li);
  }
}

async function loadHistory(watchlistId) {
  if (!watchlistId) return;
  const snaps = await loadSnapshots(watchlistId);
  $('hist-empty').style.display = 'none';
  $('hist-content').style.display = 'block';
  renderHistoryGraph(snaps);
  renderHistoryEvents(snaps);
}

// --- Wire-up -----------------------------------------------------------------

async function init() {
  // Tabs
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => setActiveTab(t.dataset.tab)));
  if (location.hash) {
    const t = location.hash.replace('#', '');
    if (['watchlist', 'diff', 'history'].includes(t)) setActiveTab(t);
  }

  // Status + watchlist
  const resp = await PP_API.runtime.sendMessage({ kind: 'get-status' });
  if (resp && resp.ok) {
    setPlanBadge(resp.plan);
    WATCHLIST = resp.watchlist || [];
    renderWatchlist();
    // populate dropdowns
    for (const sel of [$('diff-watchlist'), $('hist-watchlist')]) {
      sel.replaceChildren();
      const ph = document.createElement('option'); ph.value = ''; ph.textContent = 'select page...';
      sel.append(ph);
      for (const w of WATCHLIST) {
        const opt = document.createElement('option');
        opt.value = w.id;
        opt.textContent = (w.nickname || w.url).slice(0, 80);
        sel.append(opt);
      }
    }
  }

  // Optional ?watchlist=ID query — auto-load history
  const params = new URLSearchParams(location.search);
  const wid = params.get('watchlist');
  if (wid) {
    $('hist-watchlist').value = wid;
    $('diff-watchlist').value = wid;
    loadHistory(wid);
    onDiffWatchlistChange();
  }

  $('diff-watchlist').addEventListener('change', onDiffWatchlistChange);
  $('diff-load').addEventListener('click', loadDiff);
  $('hist-watchlist').addEventListener('change', (e) => loadHistory(e.target.value));
}

init();
