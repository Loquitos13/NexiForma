#!/usr/bin/env bash
# Prepara certificados AT sandbox na VPS (correr na raiz do repo).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CERTS="$ROOT/certs"
ZIP="${CERTS}/certificados.zip"

cd "$CERTS"
mkdir -p certificados

if [ ! -f "$ZIP" ]; then
  echo "A descarregar certificados.zip da AT..."
  curl -fsSL -o "$ZIP" \
    "https://faturas.portaldasfinancas.gov.pt/factemipf_static/java/certificados.zip"
fi

if [ ! -f certificados/saPubKey.jks ]; then
  echo "A extrair certificados.zip..."
  unzip -o "$ZIP" -d certificados
fi

cp -f certificados/TesteWebservices.pfx ./TesteWebservices.pfx

if command -v keytool >/dev/null 2>&1; then
  keytool -exportcert -alias sapubkey.testes \
    -keystore certificados/saPubKey.jks \
    -storepass saKeyPubPass \
    -rfc -file at-public-key.pem
  keytool -exportcert -alias sapubkey.prod \
    -keystore certificados/saPubKey.jks \
    -storepass saKeyPubPass \
    -rfc -file at-public-key-prod.pem
else
  echo "Aviso: keytool em falta  instale default-jre-headless"
fi

chmod 600 TesteWebservices.pfx at-public-key.pem at-public-key-prod.pem 2>/dev/null || true
[ -f "$ROOT/chaveprivada.txt" ] && chmod 600 "$ROOT/chaveprivada.txt"

echo "=== Ficheiros sandbox ==="
ls -la "$CERTS/TesteWebservices.pfx" "$CERTS/at-public-key.pem" 2>/dev/null || true
[ -f "$ROOT/chaveprivada.txt" ] && openssl rsa -in "$ROOT/chaveprivada.txt" -check -noout && echo "chaveprivada.txt OK"
