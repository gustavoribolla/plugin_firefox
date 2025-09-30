
import { computeScore } from "../shared/utils.js";

async function getMetrics(){
  const metrics = await browser.runtime.sendMessage({ type: "GET_METRICS" });
  const cookies = await browser.runtime.sendMessage({ type: "GET_COOKIES" });
  metrics.cookieSummary = cookies;
  return metrics;
}
async function getReport(){ return await browser.runtime.sendMessage({ type: "GET_REPORT" }); }
async function getConfig(){ return await browser.runtime.sendMessage({ type: "GET_CONFIG" }); }
async function saveConfig(update){ return await browser.runtime.sendMessage({ type: "SAVE_CONFIG", update }); }

function setText(id, val){ const el = document.getElementById(id); if (el) el.textContent = String(val); }

async function loadReport(){
  const data = await getReport();
  const list = document.getElementById("top-hosts");
  list.innerHTML = "";
  for (const row of data.hosts || []) {
    const li = document.createElement("li");
    li.textContent = `${row.host} — ${row.count} req${row.count>1?"s":""}${row.tracker ? " (tracker)" : ""}${row.blocked ? " [bloqueado]" : ""}`;
    list.appendChild(li);
  }
  setText("blocked", data.blocked || 0);
  setText("trk-1p", data.trackers1p || 0);
  setText("trk-3p", data.trackers3p || 0);
}

function wireControls(){
  document.getElementById("open-options").addEventListener("click", async (e)=>{
    e.preventDefault();
    await browser.runtime.openOptionsPage();
  });
  document.getElementById("toggle-block").addEventListener("change", async (e)=>{
    await saveConfig({ blockEnabled: e.target.checked });
    await loadReport();
  });
  document.getElementById("toggle-builtins").addEventListener("change", async (e)=>{
    await saveConfig({ blockBuiltins: e.target.checked });
    await loadReport();
  });
  document.getElementById("toggle-1p").addEventListener("change", async (e)=>{
    await saveConfig({ blockFirstParty: e.target.checked });
    await loadReport();
  });
  document.getElementById("btn-block-host").addEventListener("click", async ()=>{
    await browser.runtime.sendMessage({ type: "ADD_BLOCK_ACTIVE_HOST" });
    await loadReport();
  });
  document.getElementById("btn-allow-host").addEventListener("click", async ()=>{
    await browser.runtime.sendMessage({ type: "ADD_ALLOW_ACTIVE_HOST" });
    await loadReport();
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    wireControls();
    const cfg = await getConfig();
    document.getElementById("toggle-block").checked = !!cfg.blockEnabled;
    document.getElementById("toggle-builtins").checked = !!cfg.blockBuiltins;
    document.getElementById("toggle-1p").checked = !!cfg.blockFirstParty;

    const m = await getMetrics();
    setText("fp", m.firstPartyCount || 0);
    setText("tp", m.thirdPartyCount || 0);
    setText("ck-fp", m.cookieSummary?.firstParty || 0);
    setText("ck-tp", m.cookieSummary?.thirdParty || 0);
    setText("ck-sess", m.cookieSummary?.session || 0);
    setText("ck-persist", m.cookieSummary?.persistent || 0);
    setText("st-local", m.storage?.local || 0);
    setText("st-session", m.storage?.session || 0);
    setText("st-idb", m.storage?.indexedDB || 0);
    setText("canvas-flag", m.canvasFP ? "suspeito" : "não detectado");
    document.getElementById("score").textContent = computeScore(m);

    await loadReport();
  } catch (e) {
    const scoreEl = document.getElementById("score");
    if (scoreEl) scoreEl.textContent = "--";
    console.error(e);
  }
});