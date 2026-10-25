'use strict';

/**
 * Golazo render motoru
 * - Tek bir paylaşımlı Chromium (puppeteer) süreci
 * - Gömülü Inter fontu (Linux sunucuda da Windows/Mac ile aynı görünüm)
 * - Görselleri data-URI olarak gömer (HEAD/networkidle bekleme yok, çok daha hızlı ve güvenilir)
 */

const fs = require('fs');
const path = require('path');

const FONT_DIR = path.join(__dirname, '..', 'assets', 'fonts');

let browserPromise = null;
let launchToken = 0;
let active = 0;
const waiters = [];
const MAX_PARALLEL = 3;

function getPuppeteer() {
  try {
    return require('puppeteer');
  } catch (err) {
    try {
      return require('puppeteer-core');
    } catch (err2) {
      return null;
    }
  }
}

async function launchBrowser() {
  const puppeteer = getPuppeteer();
  if (!puppeteer) throw new Error('Puppeteer kurulu değil.');
  const token = ++launchToken;
  const opts = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--font-render-hinting=none',
      '--hide-scrollbars'
    ]
  };
  const exe = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROMIUM_PATH;
  if (exe) opts.executablePath = exe;
  const browser = await puppeteer.launch(opts);
  browser.on('disconnected', () => {
    if (token === launchToken) browserPromise = null;
  });
  return browser;
}

async function getBrowser() {
  if (browserPromise) {
    try {
      const existing = await browserPromise;
      if (existing && typeof existing.isConnected === 'function' && existing.isConnected()) return existing;
    } catch (err) { }
    browserPromise = null;
  }
  browserPromise = launchBrowser().catch((err) => {
    browserPromise = null;
    throw err;
  });
  return browserPromise;
}

async function closeBrowser() {
  const pending = browserPromise;
  browserPromise = null;
  launchToken++;
  if (!pending) return;
  try {
    const browser = await pending;
    if (browser && typeof browser.close === 'function') await browser.close();
  } catch (err) { }
}

function acquire() {
  if (active < MAX_PARALLEL) {
    active++;
    return Promise.resolve();
  }
  return new Promise((resolve) => waiters.push(resolve));
}

function release() {
  const next = waiters.shift();
  if (next) next();
  else active = Math.max(0, active - 1);
}

/* ---------------------------------------------------------------- font */

let fontCssCache = null;

function fontCss() {
  if (fontCssCache !== null) return fontCssCache;
  const ranges = {
    latin:
      'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
    'latin-ext':
      'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF'
  };
  let css = '';
  try {
    for (const weight of [400, 500, 600, 700, 800]) {
      for (const subset of ['latin-ext', 'latin']) {
        const file = path.join(FONT_DIR, 'inter-' + subset + '-' + weight + '-normal.woff2');
        if (!fs.existsSync(file)) continue;
        const b64 = fs.readFileSync(file).toString('base64');
        css +=
          "@font-face{font-family:'Inter';font-style:normal;font-weight:" + weight +
          ';font-display:block;src:url(data:font/woff2;base64,' + b64 + ") format('woff2');unicode-range:" +
          ranges[subset] + ';}';
      }
    }
  } catch (err) {
    css = '';
  }
  fontCssCache = css;
  return css;
}

const BASE_CSS =
  '*{margin:0;padding:0;box-sizing:border-box}' +
  'html,body{background:transparent}' +
  "body{font-family:'Inter','Segoe UI',Roboto,'Helvetica Neue',Arial,'Noto Color Emoji','Apple Color Emoji','Segoe UI Emoji',sans-serif;" +
  '-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;font-feature-settings:"tnum" 0,"cv11" 1}' +
  'svg{display:block;flex:0 0 auto}' +
  'b,strong{font-weight:700}';

/* -------------------------------------------------------------- görsel */

const imageCache = new Map();
const IMAGE_TTL = 10 * 60 * 1000;
const IMAGE_MAX_BYTES = 6 * 1024 * 1024;

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

/**
 * URL -> data URI. Başarısız olursa '' döner (şablonlar yedek tasarıma düşer).
 */
async function toDataUri(url, opts) {
  const options = opts || {};
  if (!url || typeof url !== 'string') return '';
  if (url.startsWith('data:image/')) return url;
  if (!/^https?:\/\//i.test(url)) return '';
  const hit = imageCache.get(url);
  if (hit && Date.now() - hit.at < IMAGE_TTL) return hit.value;
  let value = '';
  try {
    const res = await withTimeout(fetch(url, { redirect: 'follow' }), options.timeout || 6000);
    if (res && res.ok) {
      const type = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      if (type.startsWith('image/') && type !== 'image/svg+xml') {
        const buf = Buffer.from(await withTimeout(res.arrayBuffer(), options.timeout || 6000));
        if (buf.length > 0 && buf.length <= IMAGE_MAX_BYTES) {
          value = 'data:' + type + ';base64,' + buf.toString('base64');
        }
      }
    }
  } catch (err) {
    value = '';
  }
  imageCache.set(url, { at: Date.now(), value });
  if (imageCache.size > 300) {
    const cutoff = Date.now() - IMAGE_TTL;
    for (const [k, v] of imageCache) {
      if (v.at < cutoff) imageCache.delete(k);
    }
    if (imageCache.size > 300) imageCache.delete(imageCache.keys().next().value);
  }
  return value;
}

/* ------------------------------------------------------------ render */

/**
 * html: <body> içine yerleşecek markup. Kök eleman id="root" olmalı.
 * Dönen: PNG Buffer
 */
async function renderHtml(opts) {
  const { body, css, width, height, scale } = opts;
  const html =
    '<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><style>' +
    fontCss() + BASE_CSS + (css || '') +
    '</style></head><body>' + body + '</body></html>';

  await acquire();
  let page = null;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    await page.setViewport({ width: Math.ceil(width), height: Math.ceil(height || 600), deviceScaleFactor: scale || 2 });
    await page.setContent(html, { waitUntil: 'load', timeout: 20000 });
    try {
      await page.evaluate(() => document.fonts && document.fonts.ready);
    } catch (err) { }
    const el = await page.$('#root');
    const shot = await (el || page).screenshot({ type: 'png', omitBackground: true });
    return Buffer.from(shot);
  } finally {
    if (page) {
      try {
        await page.close();
      } catch (err) { }
    }
    release();
  }
}

module.exports = { getBrowser, closeBrowser, renderHtml, toDataUri, fontCss, BASE_CSS, withTimeout };
