// PM2 process for the studio API on jim-server. CI uploads the bundle to
// /root/turnery/api/releases/<sha7>/ and points `current` at it.
// Secrets and limits live in /root/turnery/shared/.env (not in git):
//   DEEPSEEK_API_KEY=…   STUDIO_MODEL=deepseek-flash   DAILY_BUDGET_USD=3
module.exports = {
  apps: [
    {
      name: "turnery-api",
      cwd: "/root/turnery/api",
      script: "/root/turnery/api/current/index.mjs",
      node_args: "--env-file=/root/turnery/shared/.env",
      env: { NODE_ENV: "production", PORT: "18914", HOST: "127.0.0.1", STUDIO_DATA_DIR: "/root/turnery/api/data" },
      max_memory_restart: "300M",
      out_file: "/root/turnery/api/logs/out.log",
      error_file: "/root/turnery/api/logs/error.log",
      time: true,
    },
  ],
}
