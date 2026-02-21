import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const key = crypto.randomBytes(32).toString('hex');

// Write to .env in the api package directory (where this script is run from)
const envPath = path.join(process.cwd(), '.env');

let content = '';
if (fs.existsSync(envPath)) {
  content = fs.readFileSync(envPath, 'utf-8');
}

if (content.includes('ADMIN_SECRET_KEY=')) {
  content = content.replace(/^ADMIN_SECRET_KEY=.*/m, `ADMIN_SECRET_KEY=${key}`);
} else {
  content = content.trimEnd() + `\nADMIN_SECRET_KEY=${key}\n`;
}

fs.writeFileSync(envPath, content);

console.log('');
console.log('✓ Generated ADMIN_SECRET_KEY');
console.log(`  Key   : ${key}`);
console.log(`  Saved : ${envPath}`);
console.log('');
console.log('Add this to your dashboard .env.local:');
console.log(`  NEXT_PUBLIC_ADMIN_KEY=${key}`);
console.log('');
