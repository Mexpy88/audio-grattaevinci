/* Correzione download XLSX: JSZip produce un Blob con il MIME ufficiale Excel, non application/zip. */
(function installXlsxDownloadFix(){
  'use strict';
  const XLSX_MIME='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if(!window.JSZip?.prototype?.generateAsync)return;
  const original=window.JSZip.prototype.generateAsync;
  if(original.__warehouseXlsxMimeFix)return;

  async function generateAsyncFixed(options,onUpdate){
    const opts={...(options||{})};
    if(String(opts.type||'').toLowerCase()==='blob'){
      opts.type='uint8array';
      const bytes=await original.call(this,opts,onUpdate);
      return new Blob([bytes],{type:XLSX_MIME});
    }
    return original.call(this,options,onUpdate);
  }
  generateAsyncFixed.__warehouseXlsxMimeFix=true;
  generateAsyncFixed.__warehouseOriginal=original;
  window.JSZip.prototype.generateAsync=generateAsyncFixed;
  window.WarehouseXlsxDownloadFix={mime:XLSX_MIME,version:'2026.08.20-1'};
})();
