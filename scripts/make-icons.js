// Gera PNGs de ícone/splash a partir de www/icons/icon.svg usando Playwright.
// Uso: npm run icons   (depois: npx capacitor-assets generate)
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';

const svg = readFileSync(new URL('../www/icons/icon.svg', import.meta.url), 'utf8');
mkdirSync(new URL('../assets', import.meta.url), { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();

async function shot(size, out, bg = 'transparent', scale = 1) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:${bg};display:grid;place-items:center;height:100vh">
    <div style="width:${size * scale}px;height:${size * scale}px">${svg.replace('<svg', '<svg width="100%" height="100%"')}</div></body></html>`);
  await page.screenshot({ path: new URL(out, import.meta.url).pathname, omitBackground: bg === 'transparent' });
}

await shot(192, '../www/icons/icon-192.png');
await shot(512, '../www/icons/icon-512.png');
await shot(1024, '../assets/icon-only.png', '#f3d9c6'); // lojas exigem ícone sem transparência
await shot(1024, '../assets/icon-foreground.png', 'transparent', 0.62);
await shot(1024, '../assets/icon-background.png', '#f6ebe3', 0);
await shot(2732, '../assets/splash.png', '#f6ebe3', 0.25);
await shot(2732, '../assets/splash-dark.png', '#2b1d1a', 0.25);
await browser.close();
console.log('Ícones gerados em www/icons e assets/');
