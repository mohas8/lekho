/**
 * Generates the Chrome Web Store images into docs/store/:
 *
 *   store-icon-128.png         128x128, artwork 96x96 with 16px transparent padding
 *   promo-small-440x280.png    small promo tile (required)
 *   promo-marquee-1400x560.png marquee promo tile (optional, needed to be featured)
 *   screenshot-1..4.png        1280x800 screenshots of the real extension
 *
 *   npm run build:test && npx tsx scripts/store-assets.ts
 *
 * Screenshots use the test build (it can open localhost pages without a
 * toolbar click). Needs a Bangla font installed (e.g. Noto Sans Bengali).
 */
import { chromium, type Page } from '@playwright/test';
import { createServer } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { AddressInfo } from 'node:net';
import { encodePng, renderIcon } from './gen-icons';

const root = resolve(import.meta.dirname, '..');
const out = join(root, 'docs/store');
const ext = join(root, 'dist-test');

const GREEN = '#006a4e';
const RED = '#f42a41';
const FONT = `"Noto Sans Bengali", "Noto Sans", system-ui, sans-serif`;
const iconDataUrl = `data:image/png;base64,${readFileSync(join(root, 'static/icons/icon128.png')).toString('base64')}`;

/** 128x128 store icon: the 96px artwork centred on a transparent canvas. */
function storeIcon(): Buffer {
  const art = renderIcon(96);
  const px = new Uint8Array(128 * 128 * 4);
  for (let y = 0; y < 96; y++) px.set(art.subarray(y * 96 * 4, (y + 1) * 96 * 4), ((y + 16) * 128 + 16) * 4);
  return encodePng(128, px);
}

function promoHtml(w: number, h: number): string {
  const s = h / 280; // scale from the small tile
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden}
    body{background:linear-gradient(135deg,${GREEN} 0%,#004d38 100%);font-family:${FONT};color:#fff;
      display:flex;align-items:center;justify-content:center;gap:${22 * s}px}
    img{width:${92 * s}px;height:${92 * s}px;filter:drop-shadow(0 ${4 * s}px ${10 * s}px rgba(0,0,0,.35))}
    .t{display:flex;flex-direction:column;gap:${6 * s}px}
    .name{font-size:${50 * s}px;font-weight:800;letter-spacing:.5px;line-height:1}
    .ex{font-size:${25 * s}px;font-weight:600;white-space:nowrap}
    .ex .en{font-family:"Noto Sans",system-ui;opacity:.85}
    .ex .arrow{color:${RED};margin:0 ${6 * s}px}
    ${w > 800 ? `.tag{font-size:${22 * s}px;opacity:.9;font-weight:500}` : '.tag{display:none}'}
  </style></head><body><img src="${iconDataUrl}" alt=""><div class="t">
    <div class="name">Lekho</div>
    <div class="ex"><span class="en">ami likhi</span><span class="arrow">→</span>আমি লিখি</div>
    <div class="tag">Ridmik-style Bangla typing on any website</div>
  </div></body></html>`;
}

/** Page with a caption bar and an email-style composer, for the typing screenshots. */
function composeHtml(caption: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Compose</title><style>
    html,body{margin:0;height:100%;font-family:${FONT};background:#eef2f6}
    .cap{background:${GREEN};color:#fff;padding:14px 32px;font-size:21px;font-weight:700;display:flex;align-items:center;gap:12px}
    .cap img{width:30px;height:30px}
    .card{margin:22px auto;width:680px;background:#fff;border-radius:14px;box-shadow:0 6px 24px rgba(0,0,0,.12);overflow:hidden}
    .hd{background:#f2f6fc;padding:10px 20px;font-size:15px;font-weight:600;color:#1f1f1f;font-family:"Noto Sans",system-ui}
    .row{padding:8px 20px;border-bottom:1px solid #e3e3e3;color:#5f6368;font-size:13px;font-family:"Noto Sans",system-ui}
    textarea{display:block;box-sizing:border-box;width:100%;height:190px;border:0;outline:0;resize:none;padding:14px 20px;
      font:19px/1.6 ${FONT};color:#1f1f1f}
    .ft{padding:10px 20px}
    .send{background:#0b57d0;color:#fff;border-radius:999px;padding:6px 22px;font:600 13px "Noto Sans",system-ui;display:inline-block}
  </style></head><body>
    <div class="cap"><img src="${iconDataUrl}" alt="">${caption}</div>
    <div class="card"><div class="hd">New message</div>
      <div class="row">To: friend@example.com</div><div class="row">Subject: শুভেচ্ছা</div>
      <textarea id="t" aria-label="Message"></textarea>
      <div class="ft"><span class="send">Send</span></div></div>
  </body></html>`;
}

async function shoot(page: Page, file: string): Promise<void> {
  await page.mouse.move(1, 1); // no hover highlight in the popup
  await page.screenshot({ path: join(out, file) });
  console.log(`wrote docs/store/${file}`);
}

async function main(): Promise<void> {
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'store-icon-128.png'), storeIcon());
  console.log('wrote docs/store/store-icon-128.png');

  const pages: Record<string, string> = {
    '/compose1.html': composeHtml('Type Bangla right on the page, the Ridmik way'),
    '/compose2.html': composeHtml('Word suggestions: the Ridmik result first, always'),
  };
  const server = createServer((req, res) => {
    const body = pages[req.url ?? ''];
    if (!body) return void res.writeHead(404).end();
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(body);
  });
  await new Promise<void>((r) => server.listen(0, 'localhost', r));
  const base = `http://localhost:${(server.address() as AddressInfo).port}`;

  const profile = mkdtempSync(join(tmpdir(), 'lekho-store-'));
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    headless: true,
    // 800x500 CSS pixels at 1.6x = 1280x800 image pixels: the same layout, larger and sharper.
    viewport: { width: 800, height: 500 },
    deviceScaleFactor: 1.6,
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
  });
  try {
    const sw = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    const extId = new URL(sw.url()).host;
    const enable = async (page: Page) => {
      await page.bringToFront();
      await sw.evaluate(async (url) => {
        const tab = (await chrome.tabs.query({})).find((t) => t.url === url);
        await (globalThis as unknown as { __lekhoTest: { enable(id: number): Promise<string> } }).__lekhoTest.enable(tab!.id!);
      }, page.url());
      await page.waitForFunction(() => document.documentElement.dataset.lekhoTest === 'on');
    };
    const waitForWord = (page: Page, word: string) =>
      page.waitForFunction(
        (w) => [...(document.querySelector('lekho-suggestions')?.shadowRoot?.querySelectorAll('li .w') ?? [])].some((e) => e.textContent === w),
        word,
      );

    // Promo tiles (plain HTML, no extension needed).
    for (const [w, h, file] of [
      [440, 280, 'promo-small-440x280.png'],
      [1400, 560, 'promo-marquee-1400x560.png'],
    ] as const) {
      const p = await context.newPage();
      await p.setViewportSize({ width: w / 1.6, height: h / 1.6 });
      await p.setContent(promoHtml(w / 1.6, h / 1.6));
      await p.evaluate(() => document.fonts.ready);
      await shoot(p, file);
      await p.close();
    }

    // 1: typing a sentence, the suggestion list under the last word.
    const p1 = await context.newPage();
    await p1.goto(`${base}/compose1.html`);
    await enable(p1);
    await p1.locator('#t').click();
    // হৃদয় ভরে যাক অস্তিত্বের আনন্দে
    await p1.keyboard.type('hrridoy bhore zak ostitwer ');
    await p1.keyboard.type('anonde');
    await waitForWord(p1, 'আনন্দে');
    await p1.waitForTimeout(1500); // let the dictionary answer arrive
    await shoot(p1, 'screenshot-1-typing.png');

    // 2: choosing a suggestion with the arrow key.
    const p2 = await context.newPage();
    await p2.goto(`${base}/compose2.html`);
    await enable(p2);
    await p2.locator('#t').click();
    await p2.keyboard.type('kal amar bangla ');
    await p2.keyboard.type('porikkha');
    await waitForWord(p2, 'পরীক্ষা');
    await p2.keyboard.press('ArrowDown');
    await p2.waitForTimeout(300);
    await shoot(p2, 'screenshot-2-suggestions.png');

    // 3 and 4: the settings page and the Avro guide.
    const o = await context.newPage();
    await o.goto(`chrome-extension://${extId}/options.html`);
    await o.waitForSelector('body[data-ready="true"]');
    await o.evaluate(() => document.fonts.ready);
    await shoot(o, 'screenshot-3-settings.png');
    await o.locator('#guide-heading').scrollIntoViewIfNeeded();
    await o.evaluate(() => document.getElementById('guide-heading')!.scrollIntoView({ block: 'start' }));
    await o.evaluate(() => window.scrollBy(0, -16));
    await shoot(o, 'screenshot-4-avro-guide.png');
  } finally {
    await context.close();
    server.close();
    rmSync(profile, { recursive: true, force: true });
  }
}

await main();
