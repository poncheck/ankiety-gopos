#!/bin/bash
set -e

echo ""
echo "========================================="
echo "  Aktualizacja Ankiety GoPOS"
echo "========================================="
echo ""

# 1. Pull
echo "[1/3] Pobieranie najnowszego kodu z GitHub..."
git pull origin master

echo ""

# 2. Build + restart
echo "[2/3] Przebudowanie i restart kontenerów..."
docker compose up --build -d

echo ""

# 3. Health check
echo "[3/3] Sprawdzanie statusu kontenerów..."
sleep 3
docker compose ps

echo ""
echo "========================================="
echo "  Gotowe! Aplikacja dziala pod:"
echo "  Ankieta:      http://localhost:3000"
echo "  Panel admina: http://localhost:3000/admin"
echo "  API docs:     http://localhost:8000/docs"
echo "========================================="
echo ""
echo "Logi backendu (ostatnie 20 linii):"
echo "-----------------------------------------"
docker compose logs backend --tail=20
