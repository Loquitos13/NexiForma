# Certificados AT  NexiForma

Ficheiros **nunca versionados** (ver `.gitignore`). Este README descreve o fluxo completo.

## Três papéis distintos

| Ficheiro | Função | Variável `.env` |
|----------|--------|-----------------|
| `chaveprivada.txt` | Assinatura RSA dos documentos fiscais (hash encadeado) | `AT_SAFT_PRIVATE_KEY_PATH` |
| `TesteWebservices.pfx` / `at-producer-*.pfx` | TLS cliente webservice AT | `AT_FATURAS_CLIENT_CERT_PFX_PATH` |
| `at-public-key.pem` / `at-public-key-prod.pem` | Cifra password SOAP (WS-Security) | `AT_FATURAS_PUBLIC_KEY_PATH` |

A chave do CSR (`.key`) **não** é a `chaveprivada.txt`  são pares diferentes.

---

## Fase 1  Agora (sandbox + preparar produção)

### A) Sandbox na VPS

```bash
cd ~/NexiForma
git pull
bash scripts/setup-at-sandbox-certs.sh
```

### B) Gerar novo par CSR **já** (antes da revogação)

Pode gerar `.key` + `.csr` localmente **agora**. Só **submeta** o `.csr` no portal AT **depois** da revogação do certificado antigo.

No Windows (sem OpenSSL):

```powershell
cd C:\Users\loquitos13\Desktop\projeto-guito\NexiForma

npm run generate:at-csr -- `
  --cert-number 515834963 `
  --st Lisboa `
  --city Lisboa `
  --org "EspiralEducada - Formacao e Consultoria Unipessoal Lda" `
  --ou "Forma Futuro" `
  --email admin@formafuturoportal.pt `
  --out ./certs/adesao
```

**Guardar imediatamente** (backup externo):

- `certs/adesao/515834963.key`  irrecuperável se perder
- `certs/adesao/515834963.csr`  para submeter à AT

### C) `.env` sandbox (VPS)

```env
AT_FATURAS_MODE=sandbox
AT_SERIES_MODE=sandbox
AT_FATURAS_PUBLIC_KEY_PATH=./certs/at-public-key.pem
AT_FATURAS_CLIENT_CERT_PFX_PATH=./certs/TesteWebservices.pfx
AT_FATURAS_CLIENT_CERT_PASSPHRASE=TESTEwebservice
AT_SAFT_PRIVATE_KEY_PATH=./chaveprivada.txt
AT_SAFT_HASH_CONTROL=1
AT_SOFTWARE_CERT_NUMBER=9999
```

### D) Deploy Docker (produção VPS)

```bash
docker compose -f docker-compose.prod.yml up -d --build api web
```

O `docker-compose.prod.yml` monta `./certs` e `./chaveprivada.txt` no contentor API.

### E) Testar sandbox

```bash
npm run test:at-sandbox -- faturas
```

---

## Fase 2  Depois da revogação AT

1. Portal [e-Fatura → Produtores de software → Aderir ao envio por webservice](https://faturas.portaldasfinancas.gov.pt)
2. Submeter `certs/adesao/515834963.csr`
3. Guardar o `.cer` / `.crt` recebido por email → ex.: `certs/adesao/515834963.crt`

### Criar PFX de produção

```powershell
npm run generate:at-pfx -- `
  --cert-number 515834963 `
  --crt ./certs/adesao/515834963.crt `
  --passphrase "SUA_PASSWORD_SEGURA"
```

Verificar par certificado + chave:

```powershell
npm run verify:at-cert-key -- `
  --cert ./certs/adesao/515834963.crt `
  --key ./certs/adesao/515834963.key
```

Copiar para VPS:

```powershell
scp certs\at-producer-515834963.pfx root@62.238.49.58:~/NexiForma/certs/
scp certs\adesao\515834963.key root@62.238.49.58:~/NexiForma/certs/adesao/
```

### `.env` produção

```env
AT_FATURAS_MODE=production
AT_SERIES_MODE=production
AT_FATURAS_PUBLIC_KEY_PATH=./certs/at-public-key-prod.pem
AT_FATURAS_CLIENT_CERT_PFX_PATH=./certs/at-producer-515834963.pfx
AT_FATURAS_CLIENT_CERT_PASSPHRASE=SUA_PASSWORD_SEGURA
AT_SAFT_PRIVATE_KEY_PATH=./chaveprivada.txt
AT_SAFT_HASH_CONTROL=1
AT_SOFTWARE_CERT_NUMBER=515834963
```

Reiniciar API e testar com credenciais reais do contribuinte.

---

## certificados.zip (AT)

Descarregar de: https://faturas.portaldasfinancas.gov.pt/factemipf_static/java/certificados.zip

| Ficheiro no zip | Uso |
|-----------------|-----|
| `TesteWebservices.pfx` | TLS sandbox (password `TESTEwebservice`) |
| `saPubKey.jks` | WS-Security (password `saKeyPubPass`) |

Aliases JKS: `sapubkey.testes` (sandbox), `sapubkey.prod` (produção).

O ficheiro «Chave Cifra Publica AT (Produção).cer» **não** serve  use o JKS.

OpenSSL 3 pode falhar no PFX (`RC2-40-CBC`); a API usa `node-forge`.

---

## Scripts npm

| Comando | Descrição |
|---------|-----------|
| `npm run generate:at-csr` | Gera `.key` + `.csr` (RSA 4096) |
| `npm run generate:at-pfx` | Combina `.crt` AT + `.key` → `.pfx` |
| `npm run verify:at-cert-key` | Valida par certificado/chave |
| `npm run test:at-sandbox` | Teste SOAP sandbox |
| `bash scripts/setup-at-sandbox-certs.sh` | Prepara certs sandbox na VPS |
