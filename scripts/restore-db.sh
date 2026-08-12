#!/bin/bash
# ==============================================================================
# NexiForma - Script de Restauro de Base de Dados PostgreSQL (.sql.gz ou .sql.gz.enc)
# ==============================================================================
# Uso:
#   ./scripts/restore-db.sh /caminho/para/o/backup.sql.gz
#   ./scripts/restore-db.sh /caminho/para/o/backup.sql.gz.enc "chave_opcional"
# ==============================================================================

set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "❌ Erro: Especifique o caminho do ficheiro de backup."
  echo "Exemplo: $0 /root/backup_postgres.sql.gz"
  echo "Exemplo: $0 /root/backup_postgres.sql.gz.enc \"minha_chave\""
  exit 1
fi

INPUT_FILE="$1"
ENCRYPTION_KEY="${2:-${BACKUP_ENCRYPTION_KEY:-nexiforma_secure_backup_key_2026}}"
DB_USER="${POSTGRES_USER:-nexiforma}"
DB_NAME="${POSTGRES_DB:-nexiforma}"

if [ ! -f "${INPUT_FILE}" ]; then
  echo "❌ Erro: O ficheiro '${INPUT_FILE}' não foi encontrado."
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.prod.yml"

echo "🔍 A verificar contentor PostgreSQL..."
POSTGRES_CONTAINER=$(docker compose -f "${COMPOSE_FILE}" ps -q postgres 2>/dev/null || true)

if [ -z "${POSTGRES_CONTAINER}" ]; then
  echo "⚠️ Contentor postgres em baixo. A iniciar postgres..."
  docker compose -f "${COMPOSE_FILE}" up -d postgres
  sleep 5
  POSTGRES_CONTAINER=$(docker compose -f "${COMPOSE_FILE}" ps -q postgres)
fi

TEMP_SQL_GZ="/tmp/nexiforma_restore_temp.sql.gz"
trap 'rm -f "${TEMP_SQL_GZ}"' EXIT

# 1. Se estiver encriptado (.enc), desencriptar primeiro
if [[ "${INPUT_FILE}" == *.enc ]]; then
  echo "🔐 A desencriptar ficheiro com OpenSSL..."
  openssl enc -d -aes-256-cbc -salt -pbkdf2 -in "${INPUT_FILE}" -out "${TEMP_SQL_GZ}" -k "${ENCRYPTION_KEY}"
  RESTORE_GZ="${TEMP_SQL_GZ}"
else
  RESTORE_GZ="${INPUT_FILE}"
fi

echo "🔄 A restaurar base de dados '${DB_NAME}' a partir de $(basename "${INPUT_FILE}")..."

# 2. Descomprimir e injetar diretamente no PostgreSQL
if [[ "${RESTORE_GZ}" == *.gz ]]; then
  gunzip -c "${RESTORE_GZ}" | docker exec -i "${POSTGRES_CONTAINER}" psql -U "${DB_USER}" -d "${DB_NAME}"
elif [[ "${RESTORE_GZ}" == *.sql ]]; then
  cat "${RESTORE_GZ}" | docker exec -i "${POSTGRES_CONTAINER}" psql -U "${DB_USER}" -d "${DB_NAME}"
else
  echo "❌ Formato não suportado. O ficheiro deve ser .sql, .sql.gz ou .sql.gz.enc"
  exit 1
fi

echo "✅ Base de dados restaurada com sucesso!"
echo "🔄 A reiniciar serviços API e Web..."
docker compose -f "${COMPOSE_FILE}" restart api web
echo "✨ Concluído! Aceda a: https://app.nexiforma.pt"
