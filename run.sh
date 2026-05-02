#!/bin/sh
set -e

AUTH_DIR="${WWEBJS_AUTH_DIR:-/app/.wwebjs_auth}"

# Elimina lock files de Chromium que quedan de ejecuciones anteriores
find "$AUTH_DIR" -name 'Singleton*' -delete 2>/dev/null || true

exec node dist/bot.js
