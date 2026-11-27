// package.json and app/CMakeLists.txt must name the same version.
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const cmake = readFileSync(new URL('../app/CMakeLists.txt', import.meta.url), 'utf8').match(/project\([^)]*VERSION\s+([0-9.]+)/)?.[1];

if (pkg !== cmake) {
  console.error(`package.json is ${pkg} but app/CMakeLists.txt is ${cmake}`);
  process.exit(1);
}
console.log(`version ${pkg} matches app/CMakeLists.txt`);
