(function(){'use strict';
const M=window.M365,U=window.M365Util;if(!M||!U)return;
M.getMasterVersion=async function(){if(!this.master)return null;const x=await this.fetchGraph(`/drives/${encodeURIComponent(this.master.driveId)}/items/${encodeURIComponent(this.master.itemId)}?$select=eTag,cTag,lastModifiedDateTime,size`,{session:false});return {tag:x.eTag||x.cTag||'',modified:x.lastModifiedDateTime||'',size:x.size||0}};
function same(a,b){return !!(a&&b&&((a.tag&&b.tag&&a.tag===b.tag)||(!a.tag&&!b.tag&&a.modified===b.modified&&a.size===b.size)))}
const baseRefresh=M.refreshMaster.bind(M);M.refreshMaster=async function(opts={}){const rows=await baseRefresh(opts);try{this.masterVersion=await this.getMasterVersion()}catch{}return rows};
M.refreshIfChanged=async function(opts={}){if(!this.master)throw new Error('Master online non selezionato.');let v=null;try{v=await this.getMasterVersion()}catch{return this.refreshMaster(opts)}if(this.masterVersion&&same(this.masterVersion,v)&&(db.master?.rows||[]).length){this.lastSync=new Date();this.setStatus('online');return false}await this.refreshMaster(opts);return true};
})();
