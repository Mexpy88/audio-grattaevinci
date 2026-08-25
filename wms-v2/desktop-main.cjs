const {app,BrowserWindow,shell,dialog}=require('electron');
const http=require('node:http');

const PORT=8787;
let mainWindow=null;

const gotLock=app.requestSingleInstanceLock();
if(!gotLock){app.quit();process.exit(0)}

function waitForServer(timeoutMs=15000){
  const started=Date.now();
  return new Promise((resolve,reject)=>{
    const check=()=>{
      const req=http.get(`http://127.0.0.1:${PORT}/api/health`,res=>{
        res.resume();
        if(res.statusCode===200)return resolve();
        retry();
      });
      req.on('error',retry);req.setTimeout(900,()=>req.destroy());
    };
    const retry=()=>Date.now()-started>timeoutMs?reject(new Error('Il server locale non si è avviato.')):setTimeout(check,250);
    check();
  });
}

async function start(){
  process.env.HOST='0.0.0.0';
  process.env.PORT=String(PORT);
  try{
    await import('./server.js');
    await waitForServer();
  }catch(err){
    dialog.showErrorBox('Magazzino SO',`Impossibile avviare il server locale.\n\n${err?.message||err}`);
    app.quit();return;
  }

  mainWindow=new BrowserWindow({
    title:'Magazzino SO — WMS Demo',
    width:1440,height:900,minWidth:960,minHeight:650,
    autoHideMenuBar:true,
    backgroundColor:'#edf3f8',
    webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}
  });
  mainWindow.webContents.setWindowOpenHandler(({url})=>{if(/^https?:/i.test(url))shell.openExternal(url);return {action:'deny'}});
  await mainWindow.loadURL(`http://127.0.0.1:${PORT}`);
}

app.on('second-instance',()=>{if(mainWindow){if(mainWindow.isMinimized())mainWindow.restore();mainWindow.focus()}});
app.whenReady().then(start);
app.on('window-all-closed',()=>app.quit());
