import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shotsDir = path.join(root, 'shots');
fs.mkdirSync(shotsDir, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const rel = urlPath === '/' ? '/index.html' : urlPath;
  const filePath = path.join(root, path.normalize(rel));
  if (!filePath.startsWith(root) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});

await new Promise((r) => server.listen(8788, '127.0.0.1', r));

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
});

const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});

await page.goto('http://127.0.0.1:8788/?seed=777', { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(shotsDir, 'after_menu.png') });

await page.click('#btnStartGame');
await page.waitForTimeout(300);

await page.evaluate(() => {
  window.__game.grant(5000, 2000);
  // 1~7등급 다양한 유닛 배치
  window.__game.spawnUnit('striker', 1, 0, 2);
  window.__game.spawnUnit('destroyer', 2, 1, 2);
  window.__game.spawnUnit('arcane', 3, 2, 2);
  window.__game.spawnUnit('striker', 4, 3, 2);
  window.__game.spawnUnit('destroyer', 5, 4, 2);
  window.__game.spawnUnit('arcane', 6, 5, 2);
  window.__game.spawnUnit('striker', 7, 1, 3);
  window.__game.spawnUnit('destroyer', 7, 2, 3);
  window.__game.spawnUnit('arcane', 7, 3, 3);
  window.__game.sim(3.0, 0.05);
});
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(shotsDir, 'after_gameplay.png') });

// 카메라 줌인해서 캐릭터 모델링 클로즈업 & 하단 3D 프리뷰 포트레이트 확인
await page.evaluate(() => {
  window.G.selectedUid = window.G.units[6].uid;
});
await page.click('#btnSelTarget');
for (let i = 0; i < 8; i++) {
  await page.mouse.wheel(0, -120);
}
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(shotsDir, 'after_closeup.png') });

await browser.close();
server.close();
if (errors.length) {
  console.error('Errors:', errors);
  process.exit(1);
}
console.log('Captured after screenshots successfully (0 console errors)');
