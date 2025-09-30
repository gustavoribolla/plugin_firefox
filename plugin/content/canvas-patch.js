(function(){
  function report(){ try { browser.runtime.sendMessage({ type: "CANVAS_FP" }); } catch(e){} }
  const CanvasProto = (typeof HTMLCanvasElement !== "undefined") && HTMLCanvasElement.prototype;
  const Ctx2DProto = (typeof CanvasRenderingContext2D !== "undefined") && CanvasRenderingContext2D.prototype;
  if (CanvasProto) {
    const origToDataURL = CanvasProto.toDataURL;
    CanvasProto.toDataURL = function(...args){ report(); return origToDataURL.apply(this, args); };
    const origToBlob = CanvasProto.toBlob;
    if (origToBlob) CanvasProto.toBlob = function(...args){ report(); return origToBlob.apply(this, args); };
  }
  if (Ctx2DProto) {
    const origGetImageData = Ctx2DProto.getImageData;
    Ctx2DProto.getImageData = function(...args){ report(); return origGetImageData.apply(this, args); };
  }
})();