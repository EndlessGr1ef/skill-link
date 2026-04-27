import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;

const cargoPath = join(root, 'src-tauri', 'Cargo.toml');
let cargo = readFileSync(cargoPath, 'utf8');
cargo = cargo.replace(/^(version\s*=\s*")[^"]*(")/m, `$1${version}$2`);
writeFileSync(cargoPath, cargo);

console.log(`Synced version ${version} → Cargo.toml`);
