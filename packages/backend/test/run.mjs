import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

// npm appends filters after the script; Firebase requires one command argument.
// Quote each Vitest argument so filters cannot become shell commands.
const require = createRequire(import.meta.url);
const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;
const command = ['vitest', 'run', ...process.argv.slice(2)].map(quote).join(' ');
const result = spawnSync(process.execPath, [
  require.resolve('firebase-tools/lib/bin/firebase.js'),
  'emulators:exec', '--only', 'auth,firestore', '--project', 'demo-funswitch', command,
], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
