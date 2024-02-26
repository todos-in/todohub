import fs from 'node:fs';
import path from 'node:path';

let parsedFile: Record<string, string> = {};
try {
  const envFile = fs.readFileSync(path.join(__dirname , './.env.json'), 'utf8');
  parsedFile = JSON.parse(envFile) as Record<string, string>;

  for (const [key, value] of Object.entries(parsedFile)) {
    process.env[key] = value;
  };
} catch(err) {
  console.warn('Could not set environment variables');
}

console.debug(parsedFile);
export default parsedFile;