// ガイド（Cross_Realm_Interactive_Guide.html）を組み立てる。
// 編集するのは guide/Cross_Realm_Interactive_Guide.src.html のほう。これまでブラウザで毎回
// していた JSX の変換と Tailwind の生成を前もって済ませ、読み込みを軽くする。
//   npm run build:guide
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');
const postcss = require('postcss');
const tailwindcss = require('tailwindcss');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'guide', 'Cross_Realm_Interactive_Guide.src.html');
const OUT = path.join(ROOT, 'Cross_Realm_Interactive_Guide.html');

const BABEL_TAG = '<script src="https://unpkg.com/@babel/standalone@7.23.10/babel.min.js"></script>';
const TAILWIND_TAG = '<script src="https://cdn.tailwindcss.com"></script>';
const SCRIPT_RE = /<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/;

function replaceOnce(html, from, to) {
  if (html.split(from).length !== 2) throw new Error(`見つからないか複数あります: ${from.slice(0, 60)}`);
  return html.replace(from, () => to);
}

async function build() {
  const src = fs.readFileSync(SRC, 'utf8');
  const m = src.match(SCRIPT_RE);
  if (!m) throw new Error('<script type="text/babel"> が見つかりません');

  // JSX → 普通の JS（React はページで読み込む UMD 版のグローバルを使う）
  const js = (await esbuild.transform(m[1], { loader: 'jsx', minify: true, target: 'es2018', charset: 'utf8' })).code;

  // ページ内で使われているクラスだけの Tailwind CSS（CDN 版と同じく既定設定・リセット込み）
  const tw = await postcss([tailwindcss({ content: [{ raw: src, extension: 'html' }], theme: { extend: {} }, plugins: [] })])
    .process('@tailwind base;@tailwind components;@tailwind utilities;', { from: undefined });
  const css = (await esbuild.transform(tw.css, { loader: 'css', minify: true })).code.trim();

  let html = src;
  html = replaceOnce(html, BABEL_TAG + '\n', '');
  html = replaceOnce(html, '    ' + TAILWIND_TAG + '\n', '');
  // CDN 版は Tailwind の style を head の最後に足すので、同じ順になるよう </head> の直前に置く
  html = replaceOnce(html, '</head>', `    <style>${css}</style>\n</head>`);
  html = replaceOnce(html, m[0], `<script>${js}</script>`);
  // コメントは DOCTYPE の後ろに置く（前に置くと互換モードになる）
  html = replaceOnce(html, '<!DOCTYPE html>\n', '<!DOCTYPE html>\n<!-- このファイルは自動生成です。編集は guide/Cross_Realm_Interactive_Guide.src.html で行い、npm run build:guide を実行してください。 -->\n');
  fs.writeFileSync(OUT, html);
  console.log(`guide: ${path.relative(ROOT, OUT)} (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB)`);
}

build().catch((e) => { console.error(e); process.exit(1); });
