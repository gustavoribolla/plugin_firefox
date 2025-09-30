(function(){
  const SUSPECT = [/\/hook\.js$/i, /beef/i, /evilginx/i, /phish/i];
  function flag(reason, extra){
    try { browser.runtime.sendMessage({ type: "HIJACK_FLAG", reason, extra }); } catch(e){}
  }
  const obs = new MutationObserver((muts)=>{
    for (const m of muts) {
      for (const n of (m.addedNodes || [])) {
        if (!n || !n.tagName) continue;
        const tag = n.tagName.toUpperCase();
        if (tag === "SCRIPT") {
          const src = n.src || "";
          if (SUSPECT.some(r => r.test(src))) flag("script_url", src);
          if (!src && n.textContent && /new\s+Image\(|document\.location|fetch\(.+\/hook/i.test(n.textContent)) {
            flag("inline_script", "inline");
          }
        }
        if (tag === "IFRAME") {
          const src = n.src || "";
          if (/\/ads\/|\/track\/|clickredir/i.test(src)) flag("iframe_track", src);
        }
      }
    }
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
})();