#!/bin/sh
set -eu
if [ -z "${LIVEKIT_API_KEY:-}" ] || [ -z "${LIVEKIT_API_SECRET:-}" ]; then
  echo "LIVEKIT_API_KEY and LIVEKIT_API_SECRET are required" >&2
  exit 1
fi
cat >/tmp/livekit.yaml <<EOF
port: 7880
bind_addresses:
  - ""
rtc:
  tcp_port: 7881
  port_range_start: 50000
  port_range_end: 50020
  use_external_ip: false
keys:
  ${LIVEKIT_API_KEY}: ${LIVEKIT_API_SECRET}
EOF
exec livekit-server --config /tmp/livekit.yaml
