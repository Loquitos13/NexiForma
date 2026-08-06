#!/usr/bin/env python3
"""
Projector / ecrã de presença: obtém o QR da API NexiForma e renova a cada ~60 segundos.

Requisitos:
  pip install requests qrcode[pil] pillow

Uso (sessão já iniciada no portal):
  set NEXIFORMA_API=http://localhost:4000/v1
  set NEXIFORMA_EMAIL=formador@demo.local
  set NEXIFORMA_PASSWORD=...
  python scripts/presenca_qr_display.py --sessao-id 518530b9-f577-45a3-8b00-94cfeed3ef2e

Ou com token JWT já obtido:
  python scripts/presenca_qr_display.py --sessao-id <uuid> --token <accessJwt>

O script grava `presenca-qr-atual.png` e, se possível, abre a imagem no visualizador
do sistema. Em modo --loop (defeito) volta a pedir o QR antes de expirar.
"""

from __future__ import annotations

import argparse
import os
import sys
import time
import webbrowser
from pathlib import Path

try:
    import requests
except ImportError:
    print("Instala: pip install requests", file=sys.stderr)
    sys.exit(1)

try:
    import qrcode
except ImportError:
    print("Instala: pip install 'qrcode[pil]' pillow", file=sys.stderr)
    sys.exit(1)


def login(api: str, email: str, password: str, tenant_slug: str | None) -> str:
    body: dict = {"email": email, "password": password}
    if tenant_slug:
        body["tenantSlug"] = tenant_slug
    url = f"{api.rstrip('/')}/auth/tenant/login"
    r = requests.post(url, json=body, timeout=30)
    if r.status_code >= 400:
        try:
            msg = r.json().get("message", r.text)
        except Exception:
            msg = r.text
        raise RuntimeError(f"Login HTTP {r.status_code}: {msg}")
    data = r.json()
    token = data.get("accessToken") or data.get("access_token")
    if not token:
        raise RuntimeError(f"Login sem accessToken: {data!r}")
    return str(token)


def fetch_qr(api: str, token: str, sessao_id: str) -> dict:
    url = f"{api.rstrip('/')}/sessoes-formacao/{sessao_id}/presenca-qr"
    r = requests.get(
        url,
        headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
        timeout=30,
    )
    if r.status_code >= 400:
        try:
            msg = r.json().get("message", r.text)
        except Exception:
            msg = r.text
        raise RuntimeError(f"HTTP {r.status_code}: {msg}")
    return r.json()


def render_qr(checkin_url: str, out: Path) -> None:
    img = qrcode.make(checkin_url)
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(str(out))


def main() -> int:
    p = argparse.ArgumentParser(description="QR de presença NexiForma (renovação 60s)")
    p.add_argument("--api", default=os.environ.get("NEXIFORMA_API", "http://localhost:4000/v1"))
    p.add_argument("--web-origin", default=os.environ.get("NEXIFORMA_WEB", "http://localhost:3000"))
    p.add_argument("--sessao-id", required=True)
    p.add_argument("--token", default=os.environ.get("NEXIFORMA_ACCESS_TOKEN"))
    p.add_argument("--email", default=os.environ.get("NEXIFORMA_EMAIL"))
    p.add_argument("--password", default=os.environ.get("NEXIFORMA_PASSWORD"))
    p.add_argument("--tenant-slug", default=os.environ.get("NEXIFORMA_TENANT", "demo"))
    p.add_argument(
        "--out",
        default=str(Path.cwd() / "presenca-qr-atual.png"),
        help="Ficheiro PNG do QR actual",
    )
    p.add_argument("--once", action="store_true", help="Gera uma vez e sai")
    p.add_argument("--no-open", action="store_true", help="Não abrir o PNG automaticamente")
    args = p.parse_args()

    token = args.token
    if not token:
        if not args.email or not args.password:
            print(
                "Indica --token ou NEXIFORMA_EMAIL + NEXIFORMA_PASSWORD",
                file=sys.stderr,
            )
            return 2
        print(f"A autenticar em {args.api} …")
        token = login(args.api, args.email, args.password, args.tenant_slug)

    out = Path(args.out)
    opened = False

    while True:
        try:
            data = fetch_qr(args.api, token, args.sessao_id)
        except Exception as exc:
            print(f"Erro: {exc}", file=sys.stderr)
            if "terminou" in str(exc).lower():
                print(
                    "A sessão está terminada. Inicia a sessão no portal e volta a correr o script.",
                    file=sys.stderr,
                )
                return 1
            time.sleep(15)
            continue

        path = data.get("checkinPath") or f"/presenca/{data['token']}"
        checkin_url = f"{args.web_origin.rstrip('/')}{path}"
        ttl = int(data.get("ttlSeconds") or 300)
        expires = data.get("expiresAt", "?")
        sessao = data.get("sessao") or {}

        render_qr(checkin_url, out)
        print(
            f"QR actualizado → {out} | sessão {sessao.get('numeroSessao', '?')} | "
            f"expira {expires} | {checkin_url}"
        )

        if not args.no_open and not opened:
            webbrowser.open(out.resolve().as_uri())
            opened = True

        if args.once:
            return 0

        # Renova ~15s antes do fim (mínimo 20s entre pedidos).
        sleep_s = max(20, ttl - 15)
        print(f"Próxima renovação em {sleep_s}s …")
        time.sleep(sleep_s)


if __name__ == "__main__":
    raise SystemExit(main())
