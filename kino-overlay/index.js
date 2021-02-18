const { app, BrowserWindow } = require('electron');

app.whenReady().then(_=>{
  const w = new BrowserWindow({
    width: 800,
    height: 600,
    frame: false,
    webPreferences: {
      nodeIntegration: true
    }
  });
  w.setMenuBarVisibility(false);
  w.loadFile('index.html');
});
