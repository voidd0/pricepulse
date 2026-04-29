// Cross-browser polyfill: Firefox uses promises; Chrome/Edge use callbacks
// (though MV3 chrome.* now mostly returns promises too). Provide a uniform
// promise API as PP_API used by SW + pages.

(function () {
  const ns = (typeof browser !== 'undefined' && browser.storage) ? browser : chrome;
  function p(fn) {
    return new Promise((res, rej) => {
      try {
        fn((value) => {
          const err = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError);
          if (err) rej(new Error(err.message)); else res(value);
        });
      } catch (e) { rej(e); }
    });
  }
  self.PP_API = {
    storage: {
      sync: {
        get: (keys) => p((cb) => ns.storage.sync.get(keys, cb)),
        set: (obj)  => p((cb) => ns.storage.sync.set(obj, cb)),
      },
      local: {
        get: (keys) => p((cb) => ns.storage.local.get(keys, cb)),
        set: (obj)  => p((cb) => ns.storage.local.set(obj, cb)),
      },
    },
    tabs: {
      query:  (q)  => p((cb) => ns.tabs.query(q, cb)),
      create: (o)  => p((cb) => ns.tabs.create(o, cb)),
    },
    runtime: {
      sendMessage: (m) => p((cb) => ns.runtime.sendMessage(m, cb)),
      openOptionsPage: () => p((cb) => ns.runtime.openOptionsPage(cb)),
      getURL: (path) => ns.runtime.getURL(path),
    },
  };
})();
