// App de computador do Desata! (Windows, macOS, Linux) — versão paga, sem anúncios.
// Serve a pasta do jogo por um protocolo próprio (app://) para os módulos JS
// funcionarem como num site, e abre com ?desktop=1 (desliga anúncios em config.js).
const { app, BrowserWindow, protocol, net, Menu, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = app.isPackaged ? path.join(process.resourcesPath, 'game') : path.join(__dirname, '..', 'www');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

function createWindow() {
  const win = new BrowserWindow({
    width: 480,
    height: 900,
    minWidth: 360,
    minHeight: 640,
    backgroundColor: '#f6ebe3',
    title: 'Desata!',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  // links externos (ex.: política de privacidade online) abrem no navegador
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.loadURL('app://game/index.html?desktop=1');
}

app.whenReady().then(() => {
  protocol.handle('app', (req) => {
    const { pathname } = new URL(req.url);
    const file = path.normalize(path.join(ROOT, decodeURIComponent(pathname)));
    if (!file.startsWith(ROOT)) return new Response('Não encontrado', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
  Menu.setApplicationMenu(null);
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
