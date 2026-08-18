# Certificados AT

Ficheiros **não versionados**. Colocar nesta pasta apenas no servidor (ou em secret store), nunca no git:

| Ficheiro | Variável `.env` |
|----------|-----------------|
| `at-public-key.pem` | `AT_FATURAS_PUBLIC_KEY_PATH` |
| `TesteWebservices.pfx` (sandbox) / PFX produtor | `AT_FATURAS_CLIENT_CERT_PFX_PATH` |

Descarregar `certificados.zip` da AT. O zip extrai para a subpasta `certificados/`:

- `TesteWebservices.pfx`  TLS cliente sandbox (password `TESTEwebservice`)
- `saPubKey.jks`  chave WS-Security (password `saKeyPubPass`)

Aliases no JKS: `sapubkey.testes` (sandbox), `sapubkey.prod` (produção).

Exportar chave pública sandbox:

```bash
keytool -exportcert -alias sapubkey.testes -keystore certificados/saPubKey.jks \
  -storepass saKeyPubPass -rfc -file at-public-key.pem
```

O ficheiro «Chave Cifra Publica AT (Produção).cer» **não** é X509/SPKI  ignore-o; use o JKS.

OpenSSL 3 na VPS pode falhar ao ler o PFX (`RC2-40-CBC`); a API usa `node-forge` e funciona na mesma.

Obter no Portal das Finanças (produtor de software / e-Fatura). Em produção preferir caminhos fora do repo (`/run/secrets/...`).
