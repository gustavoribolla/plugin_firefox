import { etld2, sameSite } from "../shared/utils.js";

const tabHost = new Map();
const perTab  = new Map();
const idSeenPerTab = new Map();
const hostLogPerTab = new Map();
let TRACKERS = [];

const CONFIG_DEFAULTS = {
  blockEnabled: true,
  blockBuiltins: false,
  blockFirstParty: false,
  allowlist: [],
  blocklist: []
};
let CONFIG = { ...CONFIG_DEFAULTS };

async function loadTrackers(){
  try {
    const resp = await fetch(browser.runtime.getURL("shared/trackers.json"));
    TRACKERS = await resp.json();
  } catch(e){ TRACKERS = []; }
}
async function loadConfig(){
  const saved = await browser.storage.local.get(Object.keys(CONFIG_DEFAULTS));
  CONFIG = { ...CONFIG_DEFAULTS, ...saved };
}
function watchConfig(){
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    for (const k of Object.keys(CONFIG_DEFAULTS)) {
      if (changes[k]) CONFIG[k] = changes[k].newValue;
    }
  });
}
loadTrackers(); loadConfig(); watchConfig();

function defaultMetrics() {
  return {
    firstPartyCount: 0,
    thirdPartyCount: 0,
    canvasFP: false,
    storage: { local: 0, session: 0, indexedDB: 0 },
    cookieSummary: { firstParty: 0, thirdParty: 0, session: 0, persistent: 0 },
    cookieSyncPairs: 0,
    cookieSyncExamples: [],
    hijackingFlags: 0,
    hijackingSamples: [],
    trackersFirstParty: 0,
    trackersThirdParty: 0,
    blockedRequests: 0
  };
}
function resetTab(tabId, hostname) {
  tabHost.set(tabId, hostname || tabHost.get(tabId) || "");
  perTab.set(tabId, defaultMetrics());
  idSeenPerTab.set(tabId, new Map());
  hostLogPerTab.set(tabId, new Map());
}

browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) {
    try {
      const h = new URL(changeInfo.url).hostname;
      resetTab(tabId, h);
    } catch (e) {
      resetTab(tabId, "");
    }
  }
});
browser.tabs.onRemoved.addListener((tabId) => {
  tabHost.delete(tabId);
  perTab.delete(tabId);
  idSeenPerTab.delete(tabId);
  hostLogPerTab.delete(tabId);
});

function isIn(list, host){ return list.some(t => host === t || host.endsWith("."+t)); }
function isTrackerHost(hostETLD2){ return isIn(TRACKERS, hostETLD2); }
function isBlockedHost(hostETLD2){
  if (!CONFIG.blockEnabled) return false;
  if (isIn(CONFIG.allowlist || [], hostETLD2)) return false;
  if (isIn(CONFIG.blocklist || [], hostETLD2)) return true;
  if (CONFIG.blockBuiltins && isTrackerHost(hostETLD2)) return true;
  return false;
}
function recordIdSync(tabId, idVal, hostETLD2) {
  if (!idVal) return;
  const per = idSeenPerTab.get(tabId) || new Map();
  idSeenPerTab.set(tabId, per);
  const key = String(idVal).slice(0, 120);
  let set = per.get(key);
  if (!set) { set = new Set(); per.set(key, set); }
  set.add(hostETLD2);
  if (set.size >= 2) {
    const m = perTab.get(tabId) || defaultMetrics();
    m.cookieSyncPairs = (m.cookieSyncPairs || 0) + 1;
    perTab.set(tabId, m);
  }
}

const ID_PARAM = /^(uid|user[_-]?id|cid|client[_-]?id|device[_-]?id|ga[_-]?cid|fbp|fbc|gclid|_ga|mt[_-]?id)$/i;
browser.webRequest.onBeforeRequest.addListener((details) => {
  const { tabId, url } = details;
  if (tabId < 0 || !url) return;
  try {
    const u = new URL(url);
    const reqHost = u.hostname;
    const hostE = etld2(reqHost);
    const pageHost = tabHost.get(tabId) || "";
    const metrics = perTab.get(tabId) || defaultMetrics();
    const is3p = pageHost && !sameSite(reqHost, pageHost);

    // Count request
    if (is3p) metrics.thirdPartyCount++; else metrics.firstPartyCount++;

    // Tracker classification (for report)
    if (isTrackerHost(hostE)) {
      if (is3p) metrics.trackersThirdParty++; else metrics.trackersFirstParty++;
    }

    // Cookie-sync heuristic
    for (const [k, v] of u.searchParams) if (ID_PARAM.test(k)) recordIdSync(tabId, v, hostE);

    // Host log (for Top 5 report)
    const log = hostLogPerTab.get(tabId) || new Map();
    hostLogPerTab.set(tabId, log);
    let info = log.get(hostE);
    if (!info) { info = { count: 0, tracker: isTrackerHost(hostE), blocked: false }; log.set(hostE, info); }
    info.count++;

    // Blocking decision
    let blocked = false;
    if (isBlockedHost(hostE)) {
      if (is3p || CONFIG.blockFirstParty) {
        metrics.blockedRequests++;
        info.blocked = true;
        blocked = true;
      }
    }
    perTab.set(tabId, metrics);

    if (blocked) return { cancel: true };
    return;
  } catch (e) {}
}, { urls: ["<all_urls>"] }, ["blocking"]);

browser.runtime.onMessage.addListener(async (msg, sender) => {
  try {
    if (msg?.type === "STORAGE_INFO" && sender.tab?.id >= 0) {
      const m = perTab.get(sender.tab.id) || defaultMetrics();
      m.storage = msg.data || m.storage;
      perTab.set(sender.tab.id, m);
      return;
    }
    if (msg?.type === "CANVAS_FP" && sender.tab?.id >= 0) {
      const m = perTab.get(sender.tab.id) || defaultMetrics();
      m.canvasFP = true;
      perTab.set(sender.tab.id, m);
      return;
    }
    if (msg?.type === "HIJACK_FLAG" && sender.tab?.id >= 0) {
      const m = perTab.get(sender.tab.id) || defaultMetrics();
      m.hijackingFlags = (m.hijackingFlags || 0) + 1;
      perTab.set(sender.tab.id, m);
      return;
    }
    if (msg?.type === "GET_METRICS") {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab) return defaultMetrics();
      return perTab.get(tab.id) || defaultMetrics();
    }
    if (msg?.type === "GET_COOKIES") {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab) return { firstParty: 0, thirdParty: 0, session: 0, persistent: 0 };
      const url = tab.url || "";
      let pageHost = ""; try { pageHost = new URL(url).hostname; } catch(e){}
      const storeId = tab.cookieStoreId;
      const base = etld2(pageHost);
      const full = pageHost;

      const list1 = base ? await browser.cookies.getAll({ domain: base, storeId }) : [];
      const list2 = (full && full !== base) ? await browser.cookies.getAll({ domain: full, storeId }) : [];
      const map = new Map();
      for (const c of [...list1, ...list2]) {
        const key = `${c.name}|${c.domain}|${c.path}`;
        if (!map.has(key)) map.set(key, c);
      }
      const all = [...map.values()];

      let fp = 0, tp = 0, sess = 0, persist = 0;
      for (const c of all) {
        const cdomain = (c.domain || "").replace(/^\./, "");
        const isFirst = sameSite(cdomain, pageHost);
        if (isFirst) fp++; else tp++;
        if (c.expirationDate) persist++; else sess++;
      }

      const m = perTab.get(tab.id) || defaultMetrics();
      m.cookieSummary = { firstParty: fp, thirdParty: tp, session: sess, persistent: persist };
      perTab.set(tab.id, m);
      return m.cookieSummary;
    }
    if (msg?.type === "GET_REPORT") {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab) return { hosts: [], cfg: CONFIG, trackers1p: 0, trackers3p: 0, blocked: 0 };
      const log = hostLogPerTab.get(tab.id) || new Map();
      const rows = [...log.entries()].map(([host, info]) => ({ host, count: info.count, tracker: !!info.tracker, blocked: !!info.blocked }));
      rows.sort((a,b)=> b.count - a.count);
      const m = perTab.get(tab.id) || defaultMetrics();
      return { hosts: rows.slice(0, 5), cfg: CONFIG, trackers1p: m.trackersFirstParty, trackers3p: m.trackersThirdParty, blocked: m.blockedRequests };
    }
    if (msg?.type === "GET_CONFIG") { return CONFIG; }
    if (msg?.type === "SAVE_CONFIG") {
      const next = { ...CONFIG, ...(msg.update || {}) };
      await browser.storage.local.set(next);
      return { ok: true };
    }
    if (msg?.type === "ADD_BLOCK_ACTIVE_HOST") {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab) return { ok: false };
      let pageHost = ""; try { pageHost = new URL(tab.url || "").hostname; } catch(e){}
      const h = etld2(pageHost);
      const curr = await browser.storage.local.get(["blocklist"]);
      const arr = Array.from(new Set([...(curr.blocklist || []), h]));
      await browser.storage.local.set({ blocklist: arr });
      return { ok: true, host: h };
    }
    if (msg?.type === "ADD_ALLOW_ACTIVE_HOST") {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab) return { ok: false };
      let pageHost = ""; try { pageHost = new URL(tab.url || "").hostname; } catch(e){}
      const h = etld2(pageHost);
      const curr = await browser.storage.local.get(["allowlist"]);
      const arr = Array.from(new Set([...(curr.allowlist || []), h]));
      await browser.storage.local.set({ allowlist: arr });
      return { ok: true, host: h };
    }
  } catch (e) {
    console.error("runtime.onMessage error", e);
  }
});