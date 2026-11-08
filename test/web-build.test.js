const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const { build, compare, isPublicFile } = require('../scripts/web-build.js');

const root = path.resolve(__dirname, '..');

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'babel-web-build-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const name of ['css', 'html', 'js']) fs.mkdirSync(path.join(dir, name));
  fs.writeFileSync(path.join(dir, 'index.html'), 'index');
  return dir;
}

function put(base, name, contents) {
  const filename = path.join(base, name);
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, contents);
}

test('build copies only public web assets and detects changes and missing files', t => {
  const dir = fixture(t);
  put(dir, 'js/app.js', 'export const app = true;');
  put(dir, 'css/site.css', 'body {}');
  put(dir, 'js/config.js', 'private configuration');
  put(dir, 'js/credentials.js', 'private credential');
  put(dir, 'js/app.test.js', 'test');
  put(dir, 'js/.env', 'private environment');
  put(dir, 'js/node_modules/package.js', 'dependency');
  put(dir, 'js/tests/helper.js', 'test helper');
  put(dir, 'html/data.json', 'private configuration');

  assert.deepEqual(build(dir).source, ['css/site.css', 'index.html', 'js/app.js']);
  assert.equal(fs.existsSync(path.join(dir, 'www/js/config.js')), false);
  assert.equal(fs.existsSync(path.join(dir, 'www/js/credentials.js')), false);
  assert.equal(isPublicFile('app.spec.js'), false);
  assert.equal(isPublicFile('test-mode.js'), true);

  put(dir, 'www/js/app.js', 'old');
  fs.unlinkSync(path.join(dir, 'www/css/site.css'));
  assert.deepEqual(compare(dir).changed, ['js/app.js']);
  assert.deepEqual(compare(dir).missing, ['css/site.css']);
  assert.deepEqual(build(dir).changed, []);
});

test('build refuses unexpected output and symbolic links without deleting them', t => {
  const dir = fixture(t);
  put(dir, 'www/extra.txt', 'keep');
  assert.throws(() => build(dir), /inesperados/);
  assert.equal(fs.readFileSync(path.join(dir, 'www/extra.txt'), 'utf8'), 'keep');
  fs.unlinkSync(path.join(dir, 'www/extra.txt'));
  fs.symlinkSync(path.join(dir, 'index.html'), path.join(dir, 'js/link.js'));
  assert.throws(() => build(dir), /simbólico/);
});

test('generated files exactly match the official source', () => {
  const { missing, extra, changed } = compare(root);
  assert.deepEqual({ missing, extra, changed }, { missing: [], extra: [], changed: [] });
});

test('local HTML, CSS and JavaScript resources resolve relative to their files', () => {
  const { source } = compare(root);
  for (const file of source.filter(name => /\.(html|css|js|mjs)$/.test(name))) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    const links = file.endsWith('.html')
      ? [...text.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)].map(match => match[1])
      : [];
    links.push(...[...text.matchAll(/\b(?:from\s*|import\s*\(\s*)["'](\.[^"']+)["']/g)]
      .map(match => match[1]));
    if (file.endsWith('.css')) {
      links.push(...[...text.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/gi)]
        .map(match => match[1]));
    }
    for (const link of links) {
      if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(link) || link.includes('${')) continue;
      const target = link.split(/[?#]/)[0];
      if (!target) continue;
      assert.equal(target.startsWith('/'), false, `${file}: caminho absoluto ${link}`);
      const resolved = path.resolve(root, path.dirname(file), target);
      assert.ok(resolved.startsWith(root + path.sep) && fs.existsSync(resolved), `${file}: ${link}`);
    }
  }
});

test('generated JavaScript and inline modules have valid syntax', () => {
  const { source } = compare(root);
  for (const file of source.filter(name => /\.(html|js|mjs)$/.test(name))) {
    const text = fs.readFileSync(path.join(root, 'www', file), 'utf8');
    const scripts = file.endsWith('.html')
      ? [...text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)]
        .filter(match => !/\bsrc\s*=/.test(match[1]))
        .map(match => ({ attributes: match[1], code: match[2] }))
      : [{ attributes: '', code: text }];
    for (const script of scripts) {
      if (/\btype\s*=\s*["'](?:importmap|application\/(?:ld\+)?json)["']/i.test(script.attributes)) {
        assert.doesNotThrow(() => JSON.parse(script.code), `${file}: JSON inválido`);
        continue;
      }
      const result = spawnSync(process.execPath, ['--input-type=module', '--check'], {
        input: script.code,
        encoding: 'utf8'
      });
      assert.equal(result.status, 0, `${file}: ${result.stderr}`);
    }
  }
});
