#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('dashboard/index.html', 'utf8');
const app = fs.readFileSync('dashboard/app.js', 'utf8');
const css = fs.readFileSync('dashboard/styles.css', 'utf8');
assert(html.includes('aria-describedby="instructions"'));
assert(html.includes('role="status"'));
assert(app.includes('Download JSON') && app.includes('Download Markdown'));
assert(app.includes('Download Verification Progress JSON') && app.includes('Copy Human Verification Markdown'));
assert(app.includes('textarea'));
assert(app.includes('URL.createObjectURL') && app.includes('URL.revokeObjectURL'));
assert(app.includes("button.type = 'button'"));
assert(app.includes("label.htmlFor"));
assert(app.includes("statusLabel.htmlFor"));
assert(app.includes("select.addEventListener('change'"));
assert(app.includes('Untested') && app.includes('Pass') && app.includes('Fail') && app.includes('N/A'));
assert(css.includes(':focus-visible'));
assert(css.includes('min-height: 44px'));
assert(css.includes('@media (max-width: 42rem)'));
assert(css.includes('overflow-wrap: anywhere'));
assert(css.includes('prefers-reduced-motion'));
assert(css.includes('prefers-contrast'));
assert(css.includes('.status-untested') && css.includes('.status-pass') && css.includes('.status-fail') && css.includes('.status-na'));
assert(!app.includes('localStorage') && !app.includes('sessionStorage'));
assert(!app.includes('fetch('));
assert(!app.includes('innerHTML'));
console.log('dashboard accessibility contracts passed');
