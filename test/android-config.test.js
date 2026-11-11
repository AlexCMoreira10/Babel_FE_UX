const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

test('Android manifest declares both location permissions and keeps launcher resources', () => {
  const manifest = fs.readFileSync(path.join(root, 'android/app/src/main/AndroidManifest.xml'), 'utf8');
  for (const permission of ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION']) {
    assert.match(manifest, new RegExp(`<uses-permission\\s+android:name="android\\.permission\\.${permission}"\\s*/>`));
  }
  assert.match(manifest, /android:icon="@mipmap\/ic_launcher"/);
  assert.match(manifest, /android:roundIcon="@mipmap\/ic_launcher_round"/);
});

test('icon source and generator are available without generated Android resources', () => {
  const icon = fs.readFileSync(path.join(root, 'resources/icon.png'));
  assert.equal(icon.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(icon.readUInt32BE(16), 1024);
  assert.equal(icon.readUInt32BE(20), 1024);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['android:icons'], 'node scripts/android-icons.js');
  assert.ok(pkg.devDependencies['@capacitor/assets']);
  const config = JSON.parse(fs.readFileSync(path.join(root, 'capacitor.config.json'), 'utf8'));
  assert.equal(config.webDir, 'www');
  assert.equal(config.appId, 'com.estante.babel');
});

test('Android Google sign-in explicitly enables plugin dependencies', () => {
  const variables = fs.readFileSync(path.join(root, 'android/variables.gradle'), 'utf8');
  const config = JSON.parse(fs.readFileSync(path.join(root, 'capacitor.config.json'), 'utf8'));
  assert.match(variables, /^\s*rgcfaIncludeGoogle\s*=\s*true\s*$/m);
  assert.match(variables, /^\s*androidxCredentialsVersion\s*=\s*['"]1\.3\.0['"]\s*$/m);
  assert.ok(config.plugins.FirebaseAuthentication.providers.includes('google.com'));
});
