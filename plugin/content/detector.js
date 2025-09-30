(async function(){
  function send(data){ try { browser.runtime.sendMessage(data); } catch(e) {} }
  async function checkIndexedDB() {
    try { if (indexedDB.databases) { const dblist = await indexedDB.databases(); return dblist?.length || 0; } }
    catch(e){}
    return new Promise((resolve)=>{
      try {
        const req = indexedDB.open("__probe__");
        req.onsuccess = () => { try{ req.result.close(); indexedDB.deleteDatabase("__probe__"); }catch(e){}; resolve(1); };
        req.onerror = () => resolve(0);
      } catch(e){ resolve(0); }
    });
  }
  const storageInfo = { local: 0, session: 0, indexedDB: 0 };
  try { storageInfo.local = window.localStorage?.length || 0; } catch(e){}
  try { storageInfo.session = window.sessionStorage?.length || 0; } catch(e){}
  try { storageInfo.indexedDB = await checkIndexedDB(); } catch(e){}
  send({ type: "STORAGE_INFO", data: storageInfo });
})();