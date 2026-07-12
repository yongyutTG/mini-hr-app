const fs = require('fs');
const path = require('path');

require('./build-web');

for (const fileName of fs.readdirSync(path.resolve(__dirname, '..', 'public'))) {
  if (!fileName.endsWith('.html')) continue;
  const html = fs.readFileSync(path.resolve(__dirname, '..', 'public', fileName), 'utf8');
  for (const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)) {
    new Function(match[1]);
  }
  if (html.includes('<?=')) throw new Error('Unresolved template in ' + fileName);
}

console.log('Project checks passed');
