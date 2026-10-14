import { app, BrowserWindow, ipcMain, shell, session } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

const REAL_CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

// Global user-agent fallback ensuring websites never see "Electron" or "Unknown Browser"
app.userAgentFallback = REAL_CHROME_UA;

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    title: 'Lumina SI Browser',
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      sandbox: false,
    },
  });

  const distHtml = path.join(__dirname, '../dist/index.html');

  if (process.env.VITE_DEV === '1') {
    mainWindow.loadURL('http://localhost:5173');
  } else if (fs.existsSync(distHtml)) {
    mainWindow.loadFile(distHtml);
  } else {
    mainWindow.loadURL('http://localhost:5173');
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Open untrusted popups safely in browser or new tab
    if (url.startsWith('http://') || url.startsWith('https://')) {
      mainWindow?.webContents.send('browser:open-url-in-tab', url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Set real macOS Chrome UA on default and persistent vault sessions
  session.defaultSession.setUserAgent(REAL_CHROME_UA);
  const vaultSession = session.fromPartition('persist:lumina_vault');
  vaultSession.setUserAgent(REAL_CHROME_UA);

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  app.on('web-contents-created', (_, contents) => {
    contents.setUserAgent(REAL_CHROME_UA);
    contents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        mainWindow?.webContents.send('browser:open-url-in-tab', url);
      }
      return { action: 'deny' };
    });
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC listeners
ipcMain.handle('app:get-version', () => app.getVersion());

ipcMain.on('app:open-external', (_, url: string) => {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    shell.openExternal(url);
  }
});
