#!/bin/bash
# ==============================================================================
# NexiForma - Aplicar Regras de Segurança contra ARP Spoofing e IP Spoofing
# ==============================================================================
set -euo pipefail

echo "==> A aplicar regras de segurança de rede (Anti-ARP Spoofing & Anti-IP Spoofing)..."

CONF_SOURCE="$(dirname "$0")/../deploy/security-anti-spoof.conf"
CONF_TARGET="/etc/sysctl.d/98-anti-spoof.conf"

if [ -f "${CONF_SOURCE}" ]; then
  cp "${CONF_SOURCE}" "${CONF_TARGET}"
else
  cat << 'EOF' > "${CONF_TARGET}"
net.ipv4.conf.all.arp_ignore = 1
net.ipv4.conf.default.arp_ignore = 1
net.ipv4.conf.all.arp_announce = 2
net.ipv4.conf.default.arp_announce = 2
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.default.send_redirects = 0
net.ipv4.conf.all.secure_redirects = 0
net.ipv4.conf.default.secure_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
net.ipv6.conf.default.accept_redirects = 0
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.conf.default.accept_source_route = 0
net.ipv6.conf.all.accept_source_route = 0
net.ipv6.conf.default.accept_source_route = 0
net.ipv4.tcp_syncookies = 1
net.ipv4.conf.all.log_martians = 1
net.ipv4.conf.default.log_martians = 1
EOF
fi

sysctl --system

echo "==> Regras de segurança de rede aplicadas com sucesso!"
