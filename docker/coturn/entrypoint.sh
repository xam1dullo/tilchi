#!/bin/sh
set -eu
if [ -z "${TURN_USER:-}" ] || [ -z "${TURN_PASSWORD:-}" ]; then
  echo "TURN_USER and TURN_PASSWORD are required" >&2
  exit 1
fi
external_ip_line=""
if [ -n "${TURN_EXTERNAL_IP:-}" ]; then
  external_ip_line="external-ip=${TURN_EXTERNAL_IP}"
fi
cat >/tmp/turnserver.conf <<EOF
listening-port=3478
min-port=49160
max-port=49200
fingerprint
lt-cred-mech
user=${TURN_USER}:${TURN_PASSWORD}
realm=${TURN_REALM:-tilchi.uz}
no-cli
no-tls
no-dtls
no-multicast-peers
denied-peer-ip=0.0.0.0-0.255.255.255
denied-peer-ip=10.0.0.0-10.255.255.255
denied-peer-ip=100.64.0.0-100.127.255.255
denied-peer-ip=127.0.0.0-127.255.255.255
denied-peer-ip=169.254.0.0-169.254.255.255
denied-peer-ip=172.16.0.0-172.31.255.255
denied-peer-ip=192.168.0.0-192.168.255.255
denied-peer-ip=::1
denied-peer-ip=fc00::-fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff
${external_ip_line}
EOF
exec turnserver -c /tmp/turnserver.conf
