import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.CMK_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const results = [];
const output = process.env.CMK_TEST_OUTPUT;
const pendingKey = 'cmklein-contact-pending-v1';
const draft = 'Isolated regression test. No email is sent.';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function poll(fn, expected) {
  const end = Date.now() + 5000;
  while (Date.now() < end) {
    if (await fn() === expected) return;
    await sleep(20);
  }
  assert.equal(await fn(), expected);
}
const server = http.createServer(async (req, res) => {
  try {
    let name = new URL(req.url, 'http://localhost').pathname;
    if (name === '/') name = '/index.html';
    if (!path.extname(name)) name += '.html';
    const file = path.resolve(root, '.' + name);
    if (!file.startsWith(root + path.sep)) throw new Error('Invalid path');
    const body = await fs.readFile(file);
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' })[path.extname(file)] || 'application/octet-stream');
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
let browser;
async function session(mode = 'normal', answer = { status: 200, body: { status: 'ok' } }, width = 390) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, javaScriptEnabled: mode !== 'no-js' });
  let calls = 0;
  await context.addInitScript(({ mode, pendingKey }) => {
    const timer = window.setTimeout;
    window.setTimeout = (fn, ms, ...args) => timer(fn, ms === 30000 ? 100 : ms, ...args);
    if (mode === 'stored-pending') sessionStorage.setItem(pendingKey, '1');
    if (mode === 'storage-read-fails') Storage.prototype.getItem = () => { throw new Error('Storage unavailable'); };
    if (mode === 'storage-write-fails') Storage.prototype.setItem = () => { throw new Error('Storage unavailable'); };
    if (mode === 'body-stalls' || mode === 'late-success') {
      window.fixtureCalls = 0;
      window.fetch = async () => {
        window.fixtureCalls++;
        return { ok: true, status: 200, json: () => new Promise(resolve => {
          window.fixtureLateSuccess = () => resolve({ status: 'ok' });
        }) };
      };
    }
  }, { mode, pendingKey });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname === 'inbox.caynetic.online') {
      calls++;
      const reply = typeof answer === 'function' ? answer(calls) : answer;
      if (reply.abort) { await route.abort(); return; }
      if (reply.delay) await sleep(reply.delay);
      try {
        await route.fulfill({ status: reply.status || 200, contentType: reply.text !== undefined ? 'text/html' : 'application/json', body: reply.text ?? JSON.stringify(reply.body) });
      } catch { /* The isolated timeout may already have aborted the route. */ }
    } else if (url.origin === origin) {
      if (mode === 'missing-script' && url.pathname.endsWith('/scripts.js')) await route.abort();
      else await route.continue();
    } else await route.abort(); // No real API or third-party traffic can leave the suite.
  });
  const page = await context.newPage();
  await page.goto(origin + '/contact', { waitUntil: 'load' });
  const fill = async () => {
    await page.locator('#name').fill('CMK isolated test');
    await page.locator('#email').fill('hello@caynetic.com');
    await page.locator('#message').fill(draft);
  };
  const submit = () => page.locator('#name').press('Enter');
  const forceSubmit = () => page.locator('form').evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  const count = () => calls;
  return { page, context, fill, submit, forceSubmit, count };
}
async function check(name, work) { await work(); results.push({ name, passed: true }); console.log('PASS ' + name); }
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined });
  for (const mode of ['no-js', 'missing-script']) await check(mode + ' protects native submission', async () => {
    const s = await session(mode);
    assert.equal(await s.page.locator('fieldset').getAttribute('disabled'), '');
    assert.equal(await s.page.locator('#name').isDisabled(), true);
    assert.equal(await s.page.locator('[type="submit"]').isDisabled(), true);
    assert.equal(await s.page.locator('[data-contact-fallback]').isVisible(), true);
    assert.equal(await s.page.locator('form').getAttribute('method'), 'post');
    await s.page.keyboard.press('Enter');
    assert.equal(new URL(s.page.url()).search, '');
    assert.equal(s.count(), 0);
    await s.context.close();
  });
  for (const [name, answer, expected, retry] of [
    ['confirmed success', { body: { status: 'ok' } }, 'success', true],
    ['error JSON with HTTP 200', { body: { status: 'error', error: 'not_sent' } }, 'error', false],
    ['unexpected JSON', { body: { accepted: false } }, 'error', false],
    ['HTML with HTTP 200', { text: '<h1>Service unavailable</h1>' }, 'error', false],
    ['malformed JSON', { text: '{"status":' }, 'error', false],
    ['known validation rejection', { status: 400, body: { error: 'invalid field: name' } }, 'error', true],
    ['known rate limit', { status: 429, body: { error: 'rate_limited' } }, 'error', true],
    ['unknown HTTP 400', { status: 400, body: { error: 'unexpected' } }, 'error', false],
    ['SMTP failure', { status: 500, body: { error: 'smtp_error' } }, 'error', false],
    ['token replay', { status: 400, body: { error: 'token_reused' } }, 'error', false],
    ['network failure', { abort: true }, 'error', false],
    ['header timeout', { delay: 350, body: { status: 'ok' } }, 'error', false]
  ]) await check(name, async () => {
    const s = await session('normal', answer); await s.fill(); await s.submit();
    await poll(() => s.page.locator('[data-contact-overlay]').getAttribute('data-state'), expected);
    assert.equal(await s.page.locator('#message').inputValue(), expected === 'success' ? '' : draft);
    const marker = await s.page.evaluate(key => sessionStorage.getItem(key), pendingKey);
    assert.equal(marker, retry ? null : '1');
    const stored = await s.page.evaluate(() => Object.entries(sessionStorage));
    assert.deepEqual(stored, retry ? [] : [[pendingKey, '1']]);
    if (!retry) assert.equal(await s.page.locator('.contact-feedback-title').textContent(), 'Send status unknown.');
    await s.page.locator('[data-feedback-close]').press('Enter');
    assert.equal(await s.page.locator('[type="submit"]').isEnabled(), retry);
    if (!retry) {
      assert.equal(await s.page.locator('#message').isEnabled(), true);
      assert.equal(await s.page.locator('#status').isVisible(), true);
      await s.forceSubmit(); assert.equal(s.count(), 1);
      await s.page.reload();
      assert.equal(await s.page.locator('[type="submit"]').isDisabled(), true);
      await s.forceSubmit(); assert.equal(s.count(), 1);
    }
    await s.context.close();
  });
  for (const mode of ['body-stalls', 'late-success']) await check(mode, async () => {
    const s = await session(mode); await s.fill(); await s.submit();
    await poll(() => s.page.locator('.contact-feedback-title').textContent(), 'Send status unknown.');
    assert.equal(await s.page.locator('#message').inputValue(), draft);
    if (mode === 'late-success') {
      await s.page.evaluate(() => window.fixtureLateSuccess()); await sleep(50);
      assert.equal(await s.page.locator('.contact-feedback-title').textContent(), 'Send status unknown.');
    }
    await s.page.locator('[data-feedback-close]').press('Enter');
    await s.forceSubmit();
    assert.equal(await s.page.evaluate(() => window.fixtureCalls), 1);
    assert.equal(s.count(), 0); await s.context.close();
  });
  for (const mode of ['stored-pending', 'storage-read-fails', 'storage-write-fails']) await check(mode, async () => {
    const s = await session(mode); await s.fill();
    if (mode === 'storage-write-fails') await s.submit();
    await s.forceSubmit();
    assert.equal(await s.page.locator('[type="submit"]').isDisabled(), true);
    assert.equal(s.count(), 0); assert.equal(await s.page.locator('#message').inputValue(), draft);
    assert.equal(await s.page.locator('#status').isVisible(), true); await s.context.close();
  });
  await check('known rejection permits a corrected retry', async () => {
    const s = await session('normal', n => n === 1 ? { status: 400, body: { error: 'invalid field: email' } } : { body: { status: 'ok' } });
    await s.fill(); await s.submit(); await poll(() => s.page.locator('[data-contact-overlay]').getAttribute('data-state'), 'error');
    await s.page.locator('[data-feedback-close]').press('Enter'); await s.submit();
    await poll(() => s.page.locator('[data-contact-overlay]').getAttribute('data-state'), 'success');
    assert.equal(s.count(), 2); await s.context.close();
  });
  await check('active duplicate submit is blocked', async () => {
    const s = await session('normal', { delay: 60, body: { status: 'ok' } }); await s.fill(); await s.submit();
    await s.forceSubmit(); await s.forceSubmit(); await poll(s.count, 1);
    await poll(() => s.page.locator('[data-contact-overlay]').getAttribute('data-state'), 'success');
    assert.equal(s.count(), 1); await s.context.close();
  });
  await check('validation blocks blank required fields and malformed email', async () => {
    const s = await session(); await s.submit(); assert.equal(await s.page.locator('[aria-invalid="true"]').count(), 3);
    await s.fill(); await s.page.locator('#email').fill('invalid'); await s.submit();
    assert.equal(await s.page.locator('#email').getAttribute('aria-invalid'), 'true');
    assert.equal(s.count(), 0); await s.context.close();
  });
  for (const width of [390, 1440]) await check('visual states at ' + width + 'px', async () => {
    const s = await session('normal', { abort: true }, width);
    assert.equal(await s.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    if (output) await s.page.screenshot({ path: path.join(output, 'contact-' + width + '.png'), fullPage: true });
    await s.fill(); await s.submit(); await poll(() => s.page.locator('[data-contact-overlay]').getAttribute('data-state'), 'error');
    if (output) await s.page.screenshot({ path: path.join(output, 'unconfirmed-' + width + '.png'), fullPage: true });
    await s.page.locator('[data-feedback-close]').press('Enter');
    assert.equal(await s.page.locator('[type="submit"]').isDisabled(), true);
    assert.equal(await s.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await s.context.close();
  });
  if (output) await fs.writeFile(path.join(output, 'form-verification.json'), JSON.stringify({ results, realMessagesSent: 0, deadlineAcceleratedToMs: 100 }, null, 2) + '\n');
  console.log('Verified ' + results.length + ' scenarios; no real emails sent.');
} finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
