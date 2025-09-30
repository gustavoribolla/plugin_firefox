
async function loadConfig(){ return await browser.runtime.sendMessage({ type: "GET_CONFIG" }); }
async function saveConfig(update){ return await browser.runtime.sendMessage({ type: "SAVE_CONFIG", update }); }
async function loadLists(){ const c = await loadConfig(); return { allowlist: c.allowlist||[], blocklist: c.blocklist||[] }; }
async function saveAllow(items){ await saveConfig({ allowlist: items }); }
async function saveBlock(items){ await saveConfig({ blocklist: items }); }

function liItem(text, list, saveFn) {
  const li = document.createElement("li");
  li.textContent = text + " ";
  const btn = document.createElement("button");
  btn.textContent = "remover";
  btn.addEventListener("click", async () => {
    const items = [...list.querySelectorAll("li")].map(el => el.firstChild.nodeValue.trim()).filter(v => v !== text);
    await saveFn(items);
    render();
  });
  li.appendChild(btn);
  return li;
}

async function render(){
  const cfg = await loadConfig();
  document.getElementById("cfg-enabled").checked = !!cfg.blockEnabled;
  document.getElementById("cfg-builtins").checked = !!cfg.blockBuiltins;
  document.getElementById("cfg-1p").checked = !!cfg.blockFirstParty;

  const lists = await loadLists();
  const allowUl = document.getElementById("allow-list");
  const blockUl = document.getElementById("block-list");
  allowUl.innerHTML = ""; blockUl.innerHTML = "";
  for (const a of lists.allowlist) allowUl.appendChild(liItem(a, allowUl, saveAllow));
  for (const b of lists.blocklist) blockUl.appendChild(liItem(b, blockUl, saveBlock));
}

document.addEventListener("DOMContentLoaded", async () => {
  await render();

  document.getElementById("cfg-enabled").addEventListener("change", async (e)=>{
    await saveConfig({ blockEnabled: e.target.checked });
    await render();
  });
  document.getElementById("cfg-builtins").addEventListener("change", async (e)=>{
    await saveConfig({ blockBuiltins: e.target.checked });
    await render();
  });
  document.getElementById("cfg-1p").addEventListener("change", async (e)=>{
    await saveConfig({ blockFirstParty: e.target.checked });
    await render();
  });

  document.getElementById("allow-add").addEventListener("click", async ()=>{
    const inp = document.getElementById("allow-input");
    const val = (inp.value||"").trim();
    if (!val) return;
    const cfg = await loadConfig();
    const arr = Array.from(new Set([...(cfg.allowlist||[]), val]));
    await saveConfig({ allowlist: arr });
    inp.value = ""; await render();
  });
  document.getElementById("block-add").addEventListener("click", async ()=>{
    const inp = document.getElementById("block-input");
    const val = (inp.value||"").trim();
    if (!val) return;
    const cfg = await loadConfig();
    const arr = Array.from(new Set([...(cfg.blocklist||[]), val]));
    await saveConfig({ blocklist: arr });
    inp.value = ""; await render();
  });
});