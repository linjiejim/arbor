#!/bin/sh
# The site's move from arbor.linjiejim.com to turnery.linjiejim.com (2026-11-10), server side.
# Two steps, each safe to re-run; each backs up the Caddyfile and reloads only a valid one.
#
#   ssh jim-server 'sh -s prepare' < app/scripts/move-to-turnery.sh
#     Before the PR that moves the deploy paths is merged: the new folders, the API's secrets,
#     the live build as a first release, and turnery.linjiejim.com in Caddy next to the old host.
#
#   ssh jim-server 'sh -s switch' < app/scripts/move-to-turnery.sh
#     After that PR has deployed: arbor. and featuretree.linjiejim.com hand every visitor over
#     (moved.html carries their progress; the API and files redirect), and watchtower checks the
#     new address.
#
# The old folders (/srv/arbor, /root/arbor) stay; delete them a week later.
set -e
IP=43.161.221.68
CF=/etc/caddy/Caddyfile
NEW=turnery.linjiejim.com

backup() {
  TS=$(date +%Y%m%d-%H%M%S)
  mkdir -p /root/deploy-backups
  cp -a "$CF" "/root/deploy-backups/Caddyfile.backup-$TS"
}
reload_or_restore() {
  chown -R caddy:caddy /var/log/caddy
  if caddy validate --config "$CF" --adapter caddyfile >/dev/null 2>&1 && systemctl reload caddy; then
    return 0
  fi
  # Not valid, or valid and not taken: back to the file Caddy is running, so a re-run starts over.
  cp -a "/root/deploy-backups/Caddyfile.backup-$TS" "$CF"
  echo "Caddyfile 校验或重载没通过，已经恢复原样。"
  exit 1
}

case "${1:-}" in
prepare)
  got=$(dig +short "$NEW" @119.29.29.29 2>/dev/null | tail -1)
  [ -n "$got" ] || got=$(getent hosts "$NEW" | awk '{print $1}' | head -1)
  if [ "$got" != "$IP" ]; then
    echo "$NEW 还没解析到 $IP（现在：${got:-没有}）。"
    exit 1
  fi
  mkdir -p /srv/turnery/releases /root/turnery/api/releases /root/turnery/api/logs /root/turnery/api/data /root/turnery/shared
  [ -f /root/turnery/shared/.env ] || install -m 600 /root/arbor/shared/.env /root/turnery/shared/.env
  # The live build, hard-linked: the new host answers before the first deploy lands there.
  if [ ! -e /srv/turnery/current ]; then
    CUR=$(readlink -f /srv/arbor/current)
    SEED=/srv/turnery/releases/$(basename "$CUR")
    [ -d "$SEED" ] || cp -al "$CUR" "$SEED"
    ln -sfn "$SEED" /srv/turnery/current
  fi
  if grep -q "^$NEW {\$" "$CF"; then
    echo "Caddy 里已经有 $NEW。"
  else
    backup
    # The old host's block, copied for the new host and its folder. The API is the same process.
    awk -v new="$NEW" '
      /^arbor\.linjiejim\.com \{$/ { grab = 1 }
      grab { line = $0; gsub(/arbor\.linjiejim\.com/, new, line); gsub(/\/srv\/arbor\/current/, "/srv/turnery/current", line); block = block line "\n" }
      { print }
      grab && /^\}$/ { grab = 0; printf "\n%s", block }
    ' "/root/deploy-backups/Caddyfile.backup-$TS" > "$CF"
    if ! grep -q "^$NEW {\$" "$CF"; then
      cp -a "/root/deploy-backups/Caddyfile.backup-$TS" "$CF"
      echo "Caddyfile 里没找到 arbor.linjiejim.com 的站点块，什么都没改。"
      exit 1
    fi
    reload_or_restore
  fi
  sleep 8
  echo "新域名：$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "https://$NEW/lesson/revolve")（不是 200 的话证书可能还在签，一分钟后再运行一次）"
  echo "接口：$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "https://$NEW/api/health")"
  ;;

switch)
  if [ ! -f /srv/turnery/current/moved.html ] || ! grep -q "$NEW" /srv/turnery/current/moved.html; then
    echo "新目录里的交接页还指向旧域名：等改地址的 PR 合并、部署完成后再运行。"
    exit 1
  fi
  if ! curl -fsS -o /dev/null --max-time 15 "https://$NEW/"; then
    echo "$NEW 还打不开：先运行 prepare。"
    exit 1
  fi
  if grep -q "^# Turnery's old names" "$CF"; then
    echo "已经切换过了。"
  else
    backup
    # Drop the old hosts' blocks (arbor's site block, featuretree's hand-over and its comment),
    # then add one hand-over block for both.
    awk '
      /^# Arbor.s old name \(2026-11-08\)/ { skipc = 1 }
      skipc && /^#/ { next }
      { skipc = 0 }
      /^(arbor|featuretree)\.linjiejim\.com \{$/ { skip = 1 }
      skip { if ($0 ~ /^\}$/) { skip = 0; eat = 1 } ; next }
      eat && /^$/ { eat = 0; next }
      { eat = 0; print }
    ' "/root/deploy-backups/Caddyfile.backup-$TS" > "$CF"
    cat >> "$CF" <<'BLOCK'

# Turnery's old names (featuretree until 2026-11-08, arbor until 2026-11-10). The API and files go
# straight to the new host; pages get moved.html, which takes this browser's progress along
# (localStorage is per host) and then opens the same path on turnery.linjiejim.com.
arbor.linjiejim.com, featuretree.linjiejim.com {
	import logging
	@api path /api/*
	redir @api https://turnery.linjiejim.com{uri} 308
	@files path /assets/* /models/* /og.png /favicon.svg /robots.txt /sitemap.xml
	redir @files https://turnery.linjiejim.com{uri} permanent
	handle {
		root * /srv/turnery/current
		rewrite * /moved.html
		header Cache-Control "no-cache"
		file_server
	}
}
BLOCK
    reload_or_restore
  fi
  if [ -f /root/watchtower/app/config.json ] && grep -q '"health": "https://arbor.linjiejim.com/"' /root/watchtower/app/config.json; then
    sed -i 's#"health": "https://arbor.linjiejim.com/"#"health": "https://turnery.linjiejim.com/"#' /root/watchtower/app/config.json
    . ~/.nvm/nvm.sh >/dev/null && pm2 restart watchtower >/dev/null
  fi
  sleep 2
  for old in arbor featuretree; do
    echo "$old：页面里 $(curl -s "https://$old.linjiejim.com/lesson/revolve" | grep -c 'arbor-move') 处交接脚本；接口 $(curl -s -o /dev/null -w '%{http_code} → %{redirect_url}' "https://$old.linjiejim.com/api/health")"
  done
  echo "新域名：$(curl -s -o /dev/null -w '%{http_code}' "https://$NEW/lesson/revolve")"
  ;;

*)
  echo "用法：sh -s prepare | switch（见文件开头）"
  exit 1
  ;;
esac
