#!/bin/bash
# Manusverkstaden – Quick Setup
# Run this after cloning the repo.

set -e

echo "🔧 Manusverkstaden – Setup"
echo "=========================="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js krävs men hittades inte."
    echo "   Installera från https://nodejs.org (v18+)"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js v18+ krävs. Du har v$(node -v)"
    exit 1
fi

echo "✓ Node.js $(node -v)"

# Install dependencies
echo ""
echo "📦 Installerar beroenden..."
npm install

# Setup .env
if [ ! -f .env ]; then
    cp .env.example .env
    echo ""
    echo "⚠️  .env skapad från .env.example"
    echo "   Redigera .env och lägg till din ANTHROPIC_API_KEY"
    echo "   (applikationen fungerar i demo-läge utan API-nyckel)"
fi

echo ""
echo "✅ Setup klar!"
echo ""
echo "Starta utvecklingsservern:"
echo "  npm run dev"
echo ""
echo "Öppna http://localhost:5173 i din webbläsare."
echo ""
echo "📖 Läs CLAUDE.md för utvecklingsinstruktioner."
