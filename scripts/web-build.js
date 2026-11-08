const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const sourceDirectories = ['css', 'html', 'js'];
const extensions = new Set([
  '.html', '.css', '.js', '.mjs', '.svg', '.png', '.jpg', '.jpeg',
  '.webp', '.gif', '.ico', '.woff', '.woff2', '.ttf'
]);
const excludedDirectories = new Set([
  'node_modules', 'test', 'tests', '__tests__', 'coverage', 'fixtures'
]);
const excludedFile = /(?:^\.|(?:^|[._-])(?:test|spec|config|credentials?|secrets?)(?:[._-]|$))/i;

function isPublicFile(name) {
  return extensions.has(path.extname(name).toLowerCase()) &&
    (name === 'test-mode.js' || !excludedFile.test(name));
}

function walk(directory, relative, { source }) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const name = entry.name;
    const rel = path.join(relative, name);
    if (source && (name.startsWith('.') || excludedDirectories.has(name.toLowerCase()))) continue;
    if (entry.isSymbolicLink()) throw new Error(`Link simbólico não permitido: ${rel}`);
    if (entry.isDirectory()) {
      files.push(...walk(path.join(directory, name), rel, { source }));
    } else if (entry.isFile()) {
      if (!source || isPublicFile(name)) files.push(rel);
    } else {
      throw new Error(`Entrada não suportada: ${rel}`);
    }
  }
  return files;
}

function sourceFiles(base) {
  const index = path.join(base, 'index.html');
  if (!fs.lstatSync(index).isFile()) throw new Error('index.html precisa ser um arquivo regular.');
  const files = ['index.html'];
  for (const dir of sourceDirectories) {
    const fullPath = path.join(base, dir);
    if (!fs.lstatSync(fullPath).isDirectory()) throw new Error(`${dir} precisa ser um diretório.`);
    files.push(...walk(fullPath, dir, { source: true }));
  }
  return files.sort();
}

function outputFiles(output) {
  if (!fs.existsSync(output)) return [];
  if (!fs.lstatSync(output).isDirectory()) throw new Error('www precisa ser um diretório.');
  return walk(output, '', { source: false }).sort();
}

function compare(base = root) {
  const output = path.join(base, 'www');
  const source = sourceFiles(base);
  const generated = outputFiles(output);
  const sourceSet = new Set(source);
  const generatedSet = new Set(generated);
  const missing = source.filter(file => !generatedSet.has(file));
  const extra = generated.filter(file => !sourceSet.has(file));
  const changed = source.filter(file => generatedSet.has(file) &&
    !fs.readFileSync(path.join(base, file)).equals(fs.readFileSync(path.join(output, file))));
  return { source, missing, extra, changed };
}

function build(base = root) {
  const output = path.join(base, 'www');
  const { source, extra } = compare(base);
  if (extra.length) {
    throw new Error(`Arquivos inesperados em www (não foram removidos):\n${extra.join('\n')}`);
  }
  fs.mkdirSync(output, { recursive: true });
  for (const file of source) {
    const destination = path.join(output, file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(base, file), destination);
  }
  return compare(base);
}

function report(result) {
  for (const [label, files] of [
    ['Ausentes', result.missing],
    ['Inesperados', result.extra],
    ['Diferentes', result.changed]
  ]) {
    if (files.length) console.error(`${label}:\n${files.join('\n')}`);
  }
  return result.missing.length + result.extra.length + result.changed.length === 0;
}

if (require.main === module) {
  try {
    const check = process.argv[2] === '--check';
    if (process.argv.length > 3 || (process.argv[2] && !check)) {
      throw new Error('Uso: node scripts/web-build.js [--check]');
    }
    const result = check ? compare() : build();
    if (!report(result)) process.exitCode = 1;
    else console.log(`${result.source.length} arquivos web ${check ? 'conferidos' : 'gerados'} em www.`);
  } catch (error) {
    console.error(`Erro no build web: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { build, compare, isPublicFile };
