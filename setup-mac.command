#!/bin/zsh
set -e

cd "$(dirname "$0")"

if [ "${1:-}" != "--check" ]; then
  echo ""
  echo "EssayCraft local setup"
  echo "======================"
  echo ""
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js was not found."
  echo "Install Node.js 20 or newer from https://nodejs.org/"
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm was not found."
  echo "Reinstall Node.js 20 or newer from https://nodejs.org/"
  exit 1
fi

echo "Node:"
node --version
echo "npm:"
npm --version

if [ "${1:-}" = "--check" ]; then
  echo "Setup prerequisites look OK."
  exit 0
fi

if [ ! -f ".env.local" ] && [ -f ".env.example" ]; then
  cp ".env.example" ".env.local"
  echo "Created .env.local from .env.example."
fi

echo ""
echo "Installing dependencies..."
npm install

echo ""
echo "Starting EssayCraft..."
echo "Open the Local URL printed by Next.js, usually http://localhost:3000"
echo "Press Ctrl+C in this window to stop the server."
echo ""
npm run dev
