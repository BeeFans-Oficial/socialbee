#!/bin/sh
# Subida da API dentro do container.
#
# A ordem é schema → migrations → seed → aplicação, e ela é sequencial de
# propósito: a aplicação não roda migration por conta própria (ver
# database.module.ts). Duas instâncias subindo juntas e migrando ao mesmo tempo
# é como se ganha um deadlock em produção; aqui a migration acontece uma vez,
# antes de a porta abrir.
set -e

echo "[entrypoint] garantindo o schema..."
node dist/database/ensure-schema.js

echo "[entrypoint] aplicando migrations..."
node ./node_modules/typeorm/cli.js migration:run -d dist/database/data-source.js

# O seed é idempotente (ON CONFLICT DO NOTHING) e se desliga sozinho em
# produção, então pode rodar em toda subida sem duplicar nada.
echo "[entrypoint] seed..."
node dist/database/seeds/seed.js

echo "[entrypoint] iniciando a API..."
exec "$@"
