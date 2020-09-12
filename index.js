const { app, BrowserWindow } = require('electron');

app.whenReady().then(_=>{
  const w = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true
    }
  });

  w.loadFile('index.html');
});

