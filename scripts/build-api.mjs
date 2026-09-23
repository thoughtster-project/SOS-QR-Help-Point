import { build } from 'esbuild';

for (const name of ['active-incidents', 'admin-data', 'log-event', 'qr-points']) {
  await build({
    stdin: {
      contents: `import handler from '../netlify/functions/${name}.mts'; export default { fetch: handler };`,
      resolveDir: process.cwd() + '/api',
      sourcefile: `${name}.mjs`,
      loader: 'js',
    },
    outfile: `api/${name}.mjs`,
    bundle: true,
    platform: 'node',
    format: 'esm',
    packages: 'external',
    target: 'node22',
    allowOverwrite: true,
  });
}
