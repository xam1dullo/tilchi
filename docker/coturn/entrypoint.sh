#!/bin/sh
set -eu
if [ -z "${TURN_USER:-}" ] || [ -z "${TURN_PASSWORD:-}" ]; then
  echo "TURN_USER and TURN_PASSWORD are required" >&2
  exit 1
fi
cat >/tmp/turnserver.conf <<EOF
listening-port=3478
fingerprint
lt-cred-mech
user=${TURN_USER}:${TURN_PASSWORD}
realm=${TURN_REALM:-tilchi.uz}
no-cli
no-tls
no-dtls
EOF
exec turnserver -c /tmp/turnserver.conf
