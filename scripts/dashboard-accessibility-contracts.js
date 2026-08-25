#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('dashboard/index.html', 'utf8');
const app = fs.readFileSync('dashboard/app.js', 'utf8');
const css = fs.readFileSync('dashboard/styles.css', 'utf8');
assert(html.includes('aria-describedby="instructions"'));
assert(html.includes('role="status"'));
assert(app.includes('Download JSON') && app.includes('Download Markdown'));
assert(app.includes('URL.createObjectURL') && app.includes('URL.revokeObjectURL'));
assert(app.includes('button.type = \'button\''));
assert(css.includes(':focus-visible'));
assert(css.includes('@media (max-width: 42rem)'));
assert(css.includes('prefers-reduced-motion'));
assert(css.includes('prefers-contrast'));
assert(!app.includes('localStorage') && !app.includes('sessionStorage'));
assert(!app.includes('fetch('));
console.log('dashboard accessibility contracts passed');
