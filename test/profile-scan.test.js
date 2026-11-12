const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'html/perfil.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'js/perfil.js'), 'utf8');

test('QR scanner is in the account menu and the published QR link remains', () => {
  const nav = html.match(/<nav class="profile-sidebar"[\s\S]*?<\/nav>/)[0];
  assert.equal((html.match(/id="scanQrBtn"/g) || []).length, 1);
  assert.match(nav, /<button id="scanQrBtn"[^>]*><ion-icon name="scan-outline"><\/ion-icon>Ler QR Code<\/button>/);
  assert.match(nav, /<p id="scanFeedback"[^>]*role="status"/);
  assert.match(nav, /href="\.\/qrcode\.html"[^>]*>[\s\S]*?QR Code publicado<\/a>/);
  assert.doesNotMatch(html, /Ler QR Code de um livro/);
});

test('the relocated button still runs the existing scanner and navigates to tracking', async () => {
  const start = script.indexOf('function extrairTokenRastreio(');
  const end = script.indexOf('\n/**', start);
  assert.ok(start !== -1 && end !== -1);
  const scannerScript = script.slice(start, end)
    .replace("import('@capacitor-mlkit/barcode-scanning')", 'Promise.resolve(scannerModule)')
    .replace("import('@capacitor/core')", 'Promise.resolve(capacitorModule)');
  let handler;
  let finishScan;
  let scanOptions;
  const scanQrBtn = {
    disabled: false,
    addEventListener(type, callback) {
      assert.equal(type, 'click');
      handler = callback;
    }
  };
  const scanFeedback = { textContent: '' };
  const window = { location: { href: 'https://example.test/html/perfil.html' } };
  const scannerModule = {
    BarcodeFormat: { QrCode: 'QR_CODE' },
    BarcodeScanner: {
      isSupported: async () => ({ supported: true }),
      isGoogleBarcodeScannerModuleAvailable: async () => ({ available: true }),
      scan: options => {
        scanOptions = options;
        return new Promise(resolve => { finishScan = resolve; });
      }
    }
  };
  vm.runInNewContext(scannerScript, {
    scanQrBtn, scanFeedback, window, scannerModule,
    capacitorModule: { Capacitor: { getPlatform: () => 'android' } },
    URL, console
  });
  const running = handler();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(scanQrBtn.disabled, true);
  assert.deepEqual(Array.from(scanOptions.formats), ['QR_CODE']);
  finishScan({ barcodes: [{ rawValue: 'https://example.test/livros/rastreio/token123' }] });
  await running;
  assert.equal(window.location.href, './rastreio.html?token=token123');
  assert.equal(scanQrBtn.disabled, false);
});
