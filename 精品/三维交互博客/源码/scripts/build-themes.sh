#!/usr/bin/env bash
# 把四个主题分别打包成独立网页，输出到 成品/<主题>/index.html
set -e
cd "$(dirname "$0")/.."
build() {
  VITE_THEME=$1 OUT_DIR="成品/$2" npx vite build -c vite.standalone.config.ts --logLevel warn
  echo "✓ 成品/$2/index.html"
}
build islands E-浮空群岛
build room    A-书房小屋
build planet  B-迷你星球
build galaxy  C-文章银河
