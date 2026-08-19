(function(){'use strict';
const M=window.M365,U=window.M365Util;if(!M||!U)return;
M.getMasterVersion=async function(){if(!this.master)return null;const x=await this.fetchGraph(`/drives/${encodeURIComponent(this.master.driveId)}/items/${encodeURIComponent(this.master.itemId)}?$select=eTag,cTag,lastModifiedDateTime,size`,{session:false});return {tag:x.eTag||x.cTag||'',modified:x.lastModifiedDateTime||'',size:x.size||0}};
function same(a,b){return !!(a&&b&&((a.tag&&b.tag&&a.tag===b.tag)||(!a.tag&&!b.tag&&a.modified===b.modified&&a.size===b.size)))}
const fullRefresh=M.refreshMaster.bind(M);
M.refreshMaster=async function(opts={}){if(!opts.force&&this.masterVersion&&(db.master?.rows||[]).length){try{const now=await this.getMasterVersion();if(same(this.masterVersion,now)){this.lastSync=new Date();this.online=true;this.setStatus('online');return db.master.rows}}catch{}}const rows=await fullRefresh(opts);try{this.masterVersion=await this.getMasterVersion()}catch{}return rows};
M.refreshIfChanged=async function(opts={}){return this.refreshMaster(opts)};
M.forceRefreshMaster=async function(opts={}){return this.refreshMaster({...opts,force:true})};
})();
