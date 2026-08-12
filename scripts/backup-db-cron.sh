#!/bin/bash
# ==============================================================================
# NexiForma - Script de Backup Automático e Encriptado da Base de Dados PostgreSQL
# ==============================================================================
# Execução recomendada via cron: 0 3 * * * /root/projeto-guito/NexiForma/scripts/backup-db-cron.sh
# ==============================================================================

set -euo pipefail

BACKUP_DIR="/var/backups/nexiforma/postgres"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
CONTAINER_NAME="nexiforma-postgres-1"
DB_NAME="${POSTGRES_DB:-nexiforma}"
DB_USER="${POSTGRES_USER:-nexiforma}"
BACKUP_SECRET="${BACKUP_ENCRYPTION_KEY:-nexiforma_secure_backup_key_2026}"
RETENTION_DAYS=14

# 1. Garantir diretório de destino local com permissões restritas
mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}"

RAW_FILE="${BACKUP_DIR}/dump_${TIMESTAMP}.sql.gz"
ENC_FILE="${BACKUP_DIR}/backup_postgres_${TIMESTAMP}.sql.gz.enc"

echo "[$(date -Iseconds)] A iniciar pg_dump do contentor ${CONTAINER_NAME}..."

# 2. Executar pg_dump dentro do contentor Docker e comprimir com gzip
if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  docker exec -t "${CONTAINER_NAME}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" --no-owner --clean --if-exists | gzip -9 > "${RAW_FILE}"
else
  # Fallback caso o nome do container seja nexiforma-postgres
  docker exec -t "nexiforma-postgres" pg_dump -U "${DB_USER}" -d "${DB_NAME}" --no-owner --clean --if-exists | gzip -9 > "${RAW_FILE}"
fi

# 3. Encriptar o dump comprimido com AES-256-CBC (OpenSSL com PBKDF2)
openssl enc -aes-256-cbc -salt -pbkdf2 -in "${RAW_FILE}" -out "${ENC_FILE}" -k "${BACKUP_SECRET}"
rm -f "${RAW_FILE}"

FILE_SIZE=$(du -h "${ENC_FILE}" | cut -f1)
echo "[$(date -Iseconds)] Backup concluído e encriptado com sucesso: ${ENC_FILE} (${FILE_SIZE})"

# 4. Envio opcional para Armazenamento Externo (S3 / Cloudflare R2 / Hetzner Storage Box via AWS CLI ou rclone)
if command -v aws &> /dev/null && [ -n "${BACKUP_S3_BUCKET:-}" ]; then
  echo "[$(date -Iseconds)] A sincronizar backup para S3: s3://${BACKUP_S3_BUCKET}/db-backups/..."
  aws s3 cp "${ENC_FILE}" "s3://${BACKUP_S3_BUCKET}/db-backups/$(basename "${ENC_FILE}")"
fi

if command -v rclone &> /dev/null && [ -n "${RCLONE_REMOTE_DEST:-}" ]; then
  echo "[$(date -Iseconds)] A sincronizar backup via rclone para ${RCLONE_REMOTE_DEST}..."
  rclone copy "${ENC_FILE}" "${RCLONE_REMOTE_DEST}"
fi

# 5. Rotação e limpeza de backups locais com mais de RETENTION_DAYS dias
find "${BACKUP_DIR}" -type f -name "backup_postgres_*.sql.gz.enc" -mtime +${RETENTION_DAYS} -delete
echo "[$(date -Iseconds)] Limpeza de backups antigos (> ${RETENTION_DAYS} dias) concluída."
