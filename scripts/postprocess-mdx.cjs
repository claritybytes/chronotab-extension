#!/usr/bin/env node
// scripts/postprocess-mdx.cjs
// Post-processes JSDoc/Markdown output to valid MDX (removes <dl>, <dt>, <dd>, <ul>, <li>, etc.)

const fs = require('fs');
const path = require('path');

if (process.argv.length < 3) {
  console.error('Usage: node postprocess-mdx.cjs <file1> [file2 ...]');
  process.exit(1);
}

const replacements = [
  [/<\/?dl>/g, ''],
  [/<dt>(.*?)<\/dt>/gs, '### $1\n'],
  [/<dd>(.*?)<\/dd>/gs, '$1\n'],
  [/<ul>/g, ''],
  [/<\/ul>/g, ''],
  [/<li>(.*?)<\/li>/gs, '- $1\n'],
  [/<p>(.*?)<\/p>/gs, '$1\n'],
  [/<code>(.*?)<\/code>/gs, '`$1`'],
  [/<a [^>]*href="#([^"]+)"[^>]*>(.*?)<\/a>/gs, '$2'],
  [/<br\s*\/?>(\n)?/g, '\n'],
  [/\n{3,}/g, '\n\n'],
  [/&lt;/g, '<'],
  [/&gt;/g, '>'],
];

for (const file of process.argv.slice(2)) {
  let text = fs.readFileSync(file, 'utf8');
  for (const [pattern, replacement] of replacements) {
    text = text.replace(pattern, replacement);
  }
  // Remove any stray <li> tags (open or close) left behind
  text = text.replace(/<li>/g, '');
  text = text.replace(/<\/li>/g, '');
  // Remove leading/trailing whitespace
  text = text.trim() + '\n';
  fs.writeFileSync(file, text, 'utf8');
  console.log(`Post-processed ${file}`);
}
