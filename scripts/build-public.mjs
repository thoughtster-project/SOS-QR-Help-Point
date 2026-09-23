import { copyFile, mkdir, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const output = join(root, 'dist');
if (output !== resolve(root, 'dist')) throw new Error('Unexpected output path');

const files = [
  'index.html', 'passenger.html', 'driver.html', 'admin.html', 'qr-points.html', 'bystander.html',
  'common.css', 'common.js', 'config.js', 'driver.js', 'admin.css', 'admin.js',
  'qr-points.css', 'qr-points.js', 'sw.js', 'manifest.webmanifest',
  'saferide-icon.svg', 'safebus-logo.png', 'safebus-logo-transparent.png', 'vendor/qrcode.min.js', 'vendor/qrcode.LICENSE',
];

await rm(output, { recursive: true, force: true });
for (const file of files) {
  await mkdir(resolve(output, file, '..'), { recursive: true });
  await copyFile(resolve(root, file), resolve(output, file));
}
