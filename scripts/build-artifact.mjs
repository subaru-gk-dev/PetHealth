// Build the app as one HTML file and strip it down to body-level markup
// (<title>, <style>, <div id="app">, <script>) for publishing as a page that
// wraps its own <html>/<head>/<body>.
//
//   node scripts/build-artifact.mjs   ->  dist-artifact/artifact.html

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

execSync('npx vite build -c vite.artifact.config.ts', { stdio: 'inherit' });

const html = readFileSync('dist-artifact/index.html', 'utf8');

const pick = (re) => [...html.matchAll(re)].map((m) => m[0]).join('\n');
const title = /<title>[\s\S]*?<\/title>/.exec(html)?.[0] ?? '<title>わんこ健康ノート</title>';
const styles = pick(/<style[^>]*>[\s\S]*?<\/style>/g);
const scripts = pick(/<script[^>]*>[\s\S]*?<\/script>/g);
const body = /<body[^>]*>([\s\S]*?)<\/body>/.exec(html)?.[1] ?? '';
const bodyMarkup = body.replace(/<script[^>]*>[\s\S]*?<\/script>/g, '').trim();

const out = [
  title,
  '<meta name="theme-color" content="#e08a4a">',
  styles,
  bodyMarkup,
  scripts,
].join('\n');

writeFileSync('dist-artifact/artifact.html', out);
console.log(`artifact.html written (${(out.length / 1024).toFixed(0)} kB)`);
