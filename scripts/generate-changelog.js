import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

// Read the Changelog.tsx file
const changelogTsxPath = path.join(rootDir, 'src/dashboard/pages/Changelog.tsx');
const content = fs.readFileSync(changelogTsxPath, 'utf-8');

// Extract the changelog array using regex
const arrayMatch = content.match(/const changelog: ChangelogEntry\[\] = \[([\s\S]*?)\n\];/);
if (!arrayMatch) {
  console.error('Could not find changelog array in Changelog.tsx');
  process.exit(1);
}

// Parse the entries (simple approach - eval the array after some cleanup)
// Convert TypeScript object syntax to JSON-compatible format
let arrayContent = arrayMatch[1];

// Handle the entries by parsing them manually
const entries = [];
const entryRegex = /\{\s*version:\s*'([^']+)',\s*date:\s*'([^']+)',([\s\S]*?)\s*\}/g;
let match;

while ((match = entryRegex.exec(arrayContent)) !== null) {
  const [, version, date, rest] = match;
  const entry = { version, date };

  // Parse added array
  const addedMatch = rest.match(/added:\s*\[([\s\S]*?)\]/);
  if (addedMatch) {
    entry.added = parseStringArray(addedMatch[1]);
  }

  // Parse changed array
  const changedMatch = rest.match(/changed:\s*\[([\s\S]*?)\]/);
  if (changedMatch) {
    entry.changed = parseStringArray(changedMatch[1]);
  }

  // Parse fixed array
  const fixedMatch = rest.match(/fixed:\s*\[([\s\S]*?)\]/);
  if (fixedMatch) {
    entry.fixed = parseStringArray(fixedMatch[1]);
  }

  entries.push(entry);
}

function parseStringArray(content) {
  const items = [];
  // Match single-quoted strings (handling escaped quotes), double-quoted strings
  const stringRegex = /'((?:[^'\\]|\\.)*)'/g;
  let strMatch;
  while ((strMatch = stringRegex.exec(content)) !== null) {
    // Unescape any escaped characters
    const item = strMatch[1].replace(/\\'/g, "'").replace(/\\"/g, '"');
    items.push(item);
  }
  return items;
}

// Generate markdown
let markdown = `# Changelog

All notable changes to BrowserUtils will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

`;

for (const entry of entries) {
  markdown += `## [${entry.version}] - ${entry.date}\n\n`;

  if (entry.added && entry.added.length > 0) {
    markdown += `### Added\n`;
    for (const item of entry.added) {
      markdown += `- ${item}\n`;
    }
    markdown += '\n';
  }

  if (entry.changed && entry.changed.length > 0) {
    markdown += `### Changed\n`;
    for (const item of entry.changed) {
      markdown += `- ${item}\n`;
    }
    markdown += '\n';
  }

  if (entry.fixed && entry.fixed.length > 0) {
    markdown += `### Fixed\n`;
    for (const item of entry.fixed) {
      markdown += `- ${item}\n`;
    }
    markdown += '\n';
  }
}

// Write the markdown file
const changelogMdPath = path.join(rootDir, 'CHANGELOG.md');
fs.writeFileSync(changelogMdPath, markdown.trimEnd() + '\n');

console.log('Generated CHANGELOG.md from Changelog.tsx');
