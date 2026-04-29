// Anonymous install_id — base64url, 24 chars, generated on first popup open.
// Lives in chrome.storage.local. Sent as X-Install-Id for Free-tier endpoints.
// No PII collected; this is just a per-install rate-limit key.

self.PP_getInstallId = async function PP_getInstallId() {
  const ns = (typeof browser !== 'undefined' && browser.storage) ? browser : chrome;
  const cur = await new Promise((res) => ns.storage.local.get(['pricepulseInstallId'], (v) => res(v || {})));
  if (cur.pricepulseInstallId && /^[A-Za-z0-9_-]{20,32}$/.test(cur.pricepulseInstallId)) {
    return cur.pricepulseInstallId;
  }
  const buf = new Uint8Array(18);
  self.crypto.getRandomValues(buf);
  let b64 = btoa(String.fromCharCode(...buf))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  b64 = b64.slice(0, 24);
  await new Promise((res) => ns.storage.local.set({ pricepulseInstallId: b64 }, res));
  return b64;
};
