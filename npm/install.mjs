#!/usr/bin/env node
// npx -y @minhspark/galleon-customizer@latest [options]
// Installs the build dependencies (apt), then runs install.sh from this package.
//
//   (no options)       apt dependencies, then ./install.sh --app --system
//   --no-deps          skip the apt step
//   --settings-only    only ./install.sh (config, launchers, user service)
//   --help             this text
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const args = process.argv.slice(2);

// Same list as "Install on Linux" in README.md.
const aptPackages = [
  'git', 'cmake', 'make', 'g++', 'pkg-config',
  'qt6-base-dev', 'qt6-declarative-dev', 'qt6-websockets-dev', 'libhidapi-dev',
  'qml6-module-qtquick', 'qml6-module-qtquick-window', 'qml6-module-qtqml', 'qml6-module-qtqml-workerscript',
  'python3-gi', 'gir1.2-gstreamer-1.0', 'gstreamer1.0-pipewire',
  'gstreamer1.0-plugins-good', 'gstreamer1.0-plugins-bad', 'gstreamer1.0-plugins-ugly',
  'wl-clipboard', 'xclip', 'tesseract-ocr',
];

if (args.includes('--help') || args.includes('-h')) {
  console.log(`Galleon Customizer ${version}

Usage: npx -y @minhspark/galleon-customizer@latest [options]

  (no options)       install apt dependencies, build and install the app (sudo),
                     the udev rule (sudo) and the settings
  --no-deps          skip the apt dependencies
  --settings-only    only install the settings (config, launchers, user service)
  --help             show this text`);
  process.exit(0);
}

if (process.platform !== 'linux') {
  console.error('Galleon Customizer runs on Linux (GNOME) only.');
  process.exit(1);
}

function run(command, commandArgs) {
  console.log(`\n$ ${command} ${commandArgs.join(' ')}`);
  const result = spawnSync(command, commandArgs, { cwd: root, stdio: 'inherit' });
  if (result.error) {
    console.error(`${command}: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const has = command => spawnSync('sh', ['-c', `command -v ${command}`], { stdio: 'ignore' }).status === 0;

const settingsOnly = args.includes('--settings-only');
console.log(`Galleon Customizer ${version}`);

if (!settingsOnly && !args.includes('--no-deps')) {
  if (has('apt-get')) {
    run('sudo', ['apt-get', 'update']);
    run('sudo', ['apt-get', 'install', '-y', ...aptPackages]);
  } else {
    console.warn('apt-get not found: install the build dependencies listed in README.md yourself, then run again with --no-deps.');
  }
}

run('sh', [join(root, 'install.sh'), ...(settingsOnly ? [] : ['--app', '--system'])]);

if (!settingsOnly) {
  console.log('\nUnplug the keyboard and plug it back in once.');
  console.log('Check the daemon: systemctl --user status galleon-customizerd');
}
