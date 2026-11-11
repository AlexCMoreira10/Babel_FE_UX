const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const target = path.join(root, 'android/app/src/main');
const manifest = path.join(target, 'AndroidManifest.xml');
const icon = path.join(root, 'resources/icon.png');
const generator = path.join(root, 'node_modules/@capacitor/assets/bin/capacitor-assets');

if (!fs.existsSync(path.join(root, 'android/app/build.gradle'))) {
  throw new Error('Projeto Android incompleto. Prepare-o conforme o README antes de gerar os ícones.');
}

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'babel-android-icons-'));
try {
  const project = path.join(scratch, 'android');
  const main = path.join(project, 'app/src/main');
  fs.mkdirSync(main, { recursive: true });
  fs.mkdirSync(path.join(scratch, 'resources'));
  fs.copyFileSync(manifest, path.join(main, 'AndroidManifest.xml'));
  fs.copyFileSync(icon, path.join(scratch, 'resources/icon.png'));
  fs.copyFileSync(path.join(root, 'android/app/build.gradle'), path.join(project, 'app/build.gradle'));
  const result = spawnSync(process.execPath, [generator, 'generate', '--android', '--assetPath', 'resources'], {
    cwd: scratch,
    stdio: 'inherit'
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Falha ao gerar ícones (código ${result.status}).`);

  const res = path.join(main, 'res');
  const densities = ['ldpi', 'mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];
  const files = densities.flatMap(density => [
    'ic_launcher.png', 'ic_launcher_round.png',
    'ic_launcher_foreground.png', 'ic_launcher_background.png'
  ].map(name => path.join(`mipmap-${density}`, name)));
  files.push('mipmap-anydpi-v26/ic_launcher.xml', 'mipmap-anydpi-v26/ic_launcher_round.xml');
  for (const file of files) {
    if (!fs.statSync(path.join(res, file)).isFile()) throw new Error(`Ícone ausente: ${file}`);
  }
  for (const file of files) {
    const destination = path.join(target, 'res', file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(res, file), destination);
  }
  console.log(`${files.length} arquivos de ícone Android gerados. Outros recursos foram preservados.`);
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}
