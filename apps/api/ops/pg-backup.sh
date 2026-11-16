#!/bin/sh
# Backup diário do Postgres (serviço "backup" do compose).
# Um arquivo por dia da semana (arp-1-Mon.dump … arp-7-Sun.dump): o da semana
# seguinte sobrescreve, então nunca passa de 7. Grava em .tmp e só troca se o
# dump terminar, para um dump com falha não apagar o último bom.
# Roda um na subida e depois todo dia às 03:00 (TZ do container).
set -u
DIR=/backups

dump() {
  f="$DIR/arp-$(date +%u-%a).dump"
  if pg_dump -Fc -f "$f.tmp" postgres; then
    mv "$f.tmp" "$f"
    echo "$(date -Iseconds) backup ok: $f ($(du -h "$f" | cut -f1))"
  else
    rm -f "$f.tmp"
    echo "$(date -Iseconds) BACKUP FALHOU" >&2
  fi
}

until pg_isready -q; do sleep 2; done
dump
while true; do
  h=$(date +%H | sed 's/^0//'); m=$(date +%M | sed 's/^0//'); s=$(date +%S | sed 's/^0//')
  wait=$(( (3 * 3600 - (h * 3600 + m * 60 + s) + 86400) % 86400 ))
  [ "$wait" -eq 0 ] && wait=86400
  sleep "$wait"
  dump
done
