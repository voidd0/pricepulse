// pricepulse shared constants — concatenated into SW + loaded by popup/options/app.

self.PP_CONFIG = {
  PRODUCT: 'pricepulse',
  VERSION: '1.0.0',
  // API_BASE points at the existing scrb backend.
  API_BASE: 'https://scrb.voiddo.com/api/v1/ext',
  // Free-tier client-side mirror of server caps. Server is authoritative; these
  // numbers are only used to render the meter in the popup.
  FREE_WATCHLIST_LIMIT: 5,
  FREE_CHECK_INTERVAL_LABEL: 'weekly',
  PRO_WATCHLIST_LIMIT: 50,
  PRO_CHECK_INTERVAL_LABEL: 'daily',
  PROPLUS_WATCHLIST_LIMIT: 500,
  PROPLUS_CHECK_INTERVAL_LABEL: 'hourly',
};
