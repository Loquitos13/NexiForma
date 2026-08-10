# Certificados AT

Ficheiros **não versionados**. Colocar nesta pasta apenas no servidor (ou em secret store), nunca no git:

| Ficheiro | Variável `.env` |
|----------|-----------------|
| `at-public-key.pem` | `AT_FATURAS_PUBLIC_KEY_PATH` |
| `at-producer.pfx` | `AT_FATURAS_CLIENT_CERT_PFX_PATH` |

Obter no Portal das Finanças (produtor de software / e-Fatura). Em produção preferir caminhos fora do repo (`/run/secrets/...`).
