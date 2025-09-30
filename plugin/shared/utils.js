export function etld2(hostname) {
  if (!hostname) return "";
  const parts = hostname.split(".").filter(Boolean);
  if (parts.length <= 2) return hostname;
  return parts.slice(-2).join(".");
}
export function sameSite(a, b) {
  return etld2(a) === etld2(b);
}
export function computeScore(metrics) {
  let score = 100;
  const tp = metrics.thirdPartyCount || 0;
  const tpCookies = metrics.cookieSummary?.thirdParty || 0;
  const st = metrics.storage || {};
  score -= Math.min(tp * 2, 30);
  score -= Math.min(tpCookies * 2, 20);
  score -= st.local ? 5 : 0;
  score -= st.session ? 5 : 0;
  score -= st.indexedDB ? 5 : 0;
  score -= metrics.canvasFP ? 15 : 0;
  score -= (metrics.cookieSyncPairs || 0) * 5;
  score -= (metrics.hijackingFlags || 0) * 15;
  score += Math.min(metrics.blockedRequests || 0, 20) * 0.2;
  return Math.max(0, Math.round(score));
}