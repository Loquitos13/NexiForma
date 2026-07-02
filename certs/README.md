# Certificados AT (testes)

Ficheiros **não versionados** - obter no Portal das Finanças:

1. [certificados.zip](https://faturas.portaldasfinancas.gov.pt/factemipf_static/java/certificados.zip) - `TesteWebservices.pfx` + chave pública
2. FAQ: [webservice faturas AT](https://info.portaldasfinancas.gov.pt/pt/apoio_contribuinte/questoes_frequentes/pages/faqs-00996.aspx)

Colocar nesta pasta:

| Ficheiro | Variável `.env` |
|----------|-----------------|
| `TesteWebservices.pfx` | `AT_FATURAS_CLIENT_CERT_PFX_PATH=./certs/TesteWebservices.pfx` |
| `ChavePublicaAT.cer` ou `at-public-key.pem` | `AT_FATURAS_PUBLIC_KEY_PATH=./certs/at-public-key.pem` |

Password PFX de testes: `TESTEwebservice`

Credenciais demo AT (sandbox): NIF `599999993`, subutilizador `37`, password `testes1234`

Testar ligação:

```bash
npm run test:at-sandbox -- faturas
npm run test:at-sandbox -- series
```

**Nota importante (2025+):** o [certificados.zip](https://faturas.portaldasfinancas.gov.pt/factemipf_static/java/certificados.zip) oficial **não é actualizado** desde 2020 (`TesteWebservices.pfx` de 09/11/2020). O certificado de cliente **expirou em 2021-05-08** e a cadeia DGITA expirou em **2025-06-28**. Descarregar de novo o mesmo zip **não resolve** o erro TLS.

A AT migrou para uma nova entidade certificadora (RSA 4096 bits) - ver [Nova Entidade Certificadora](https://info.portaldasfinancas.gov.pt/pt/destaques/Paginas/Nova_Entidade_Certificadora.aspx). Para certificado de testes actualizado, contactar **asi-psws@at.gov.pt** (NIF, software, n.º certificado) ou emitir CSR no Portal e-Fatura → Produtores de Software.

Enquanto não houver certificado válido, use simulação local: `AT_FATURAS_SANDBOX_MOCK=1` e `AT_SERIES_SANDBOX_MOCK=1`.
