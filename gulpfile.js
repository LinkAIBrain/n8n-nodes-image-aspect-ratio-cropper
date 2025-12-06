const { src, dest, parallel } = require('gulp');

function buildIcons() {
  return src('nodes/**/*.svg').pipe(dest('dist/nodes'));
}

function buildCodex() {
  return src('nodes/**/*.node.json').pipe(dest('dist/nodes'));
}

exports['build:icons'] = buildIcons;
exports['build:codex'] = buildCodex;
exports['build:assets'] = parallel(buildIcons, buildCodex);

