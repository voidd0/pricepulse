// pricepulse SW — message router.
//
// IMPORTANT: build.sh prepends src/shared/{constants,browser,install_id}.js
// before this file when assembling dist/<browser>/background/service-worker.js,
// so PP_CONFIG, PP_API, PP_getInstallId are global at runtime. This trick lets
// Firefox MV3 background.scripts (which can't use importScripts) work the same
// way as Chrome MV3 service_worker.

const ns = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;

async function authHeaders() {
  // If the user has a license key, use it (Pro / Pro+); otherwise install_id (Free).
  const sync = await PP_API.storage.sync.get(['pricepulseLicenseKey']);
  const headers = { 'Content-Type': 'application/json' };
  if (sync.pricepulseLicenseKey) {
    headers['X-License-Key'] = sync.pricepulseLicenseKey;
  } else {
    headers['X-Install-Id'] = await PP_getInstallId();
  }
  return headers;
}

async function api(path, opts = {}) {
  const url = `${PP_CONFIG.API_BASE}/pricepulse${path}`;
  const headers = Object.assign(await authHeaders(), opts.headers || {});
  const resp = await fetch(url, { ...opts, headers });
  const text = await resp.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!resp.ok) {
    return { ok: false, status: resp.status, error: json };
  }
  return { ok: true, status: resp.status, data: json };
}

// Cached license-state. Refreshed on demand + every 24h.
let LICENSE_CACHE = null; // { plan, expires_at, checked_at }

async function getLicenseState(force = false) {
  const now = Date.now();
  if (!force && LICENSE_CACHE && (now - LICENSE_CACHE.checked_at) < 24 * 3600 * 1000) {
    return LICENSE_CACHE;
  }
  const sync = await PP_API.storage.sync.get(['pricepulseLicenseKey']);
  if (!sync.pricepulseLicenseKey) {
    LICENSE_CACHE = { plan: 'free', expires_at: null, checked_at: now };
    return LICENSE_CACHE;
  }
  // license/<product> endpoint shared with jobmeta
  const r = await api('/../license/pricepulse');
  if (r.ok) {
    LICENSE_CACHE = {
      plan: r.data.plan || 'free',
      expires_at: r.data.expires_at,
      checked_at: now,
    };
  } else {
    // 72h offline grace — keep cached plan, just bump checked_at to retry later
    if (LICENSE_CACHE) {
      LICENSE_CACHE.checked_at = now;
    } else {
      LICENSE_CACHE = { plan: 'free', expires_at: null, checked_at: now };
    }
  }
  return LICENSE_CACHE;
}

ns.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      switch (msg && msg.kind) {
        case 'get-status': {
          const lic = await getLicenseState();
          const list = await api('/watchlist', { method: 'GET' });
          sendResponse({
            ok: true,
            plan: lic.plan,
            installId: await PP_getInstallId(),
            watchlist: list.ok ? list.data.items : [],
            limit:
              lic.plan === 'pro_plus' ? PP_CONFIG.PROPLUS_WATCHLIST_LIMIT :
              lic.plan === 'pro'      ? PP_CONFIG.PRO_WATCHLIST_LIMIT :
                                        PP_CONFIG.FREE_WATCHLIST_LIMIT,
          });
          return;
        }
        case 'check-license': {
          const lic = await getLicenseState(true);
          sendResponse({ ok: true, plan: lic.plan, expires_at: lic.expires_at });
          return;
        }
        case 'add-watchlist': {
          const r = await api('/watchlist', {
            method: 'POST',
            body: JSON.stringify({
              url: msg.url,
              nickname: msg.nickname || '',
            }),
          });
          sendResponse(r);
          return;
        }
        case 'remove-watchlist': {
          const r = await api(`/watchlist/${encodeURIComponent(msg.id)}`, { method: 'DELETE' });
          sendResponse(r);
          return;
        }
        case 'list-snapshots': {
          const r = await api(`/snapshots/${encodeURIComponent(msg.watchlistId)}`, { method: 'GET' });
          sendResponse(r);
          return;
        }
        case 'get-diff': {
          const r = await api(`/diff/${encodeURIComponent(msg.a)}/${encodeURIComponent(msg.b)}`, { method: 'GET' });
          sendResponse(r);
          return;
        }
        case 'extract-tiers': {
          const r = await api('/extract-tiers', {
            method: 'POST',
            body: JSON.stringify({ url: msg.url }),
          });
          sendResponse(r);
          return;
        }
        case 'open-app': {
          await PP_API.tabs.create({ url: ns.runtime.getURL('pages/app.html') });
          sendResponse({ ok: true });
          return;
        }
        case 'open-options': {
          await PP_API.runtime.openOptionsPage();
          sendResponse({ ok: true });
          return;
        }
        case 'open-upgrade': {
          await PP_API.tabs.create({ url: 'https://extensions.voiddo.com/pricepulse/upgrade/' });
          sendResponse({ ok: true });
          return;
        }
        case 'forget-license': {
          await PP_API.storage.sync.set({ pricepulseLicenseKey: '' });
          LICENSE_CACHE = null;
          sendResponse({ ok: true });
          return;
        }
        default:
          sendResponse({ ok: false, error: 'unknown_kind' });
      }
    } catch (e) {
      sendResponse({ ok: false, error: String(e && e.message || e) });
    }
  })();
  return true; // keep the channel open for async response
});

ns.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await PP_getInstallId();
    await PP_API.tabs.create({ url: ns.runtime.getURL('pages/welcome.html') });
  }
});
