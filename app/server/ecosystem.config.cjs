// PM2 process for the studio API on jim-server. CI uploads the bundle to
// /root/featuretree/api/releases/<sha7>/ and points `current` at it.
// Secrets and limits live in /root/featuretree/shared/.env (not in git):
//   DEEPSEEK_API_KEY=…   STUDIO_MODEL=deepseek-flash   DAILY_BUDGET_USD=3
module.exports = {
  apps: [
    {
      name: "featuretree-api",
      cwd: "/root/featuretree/api",
      script: "/root/featuretree/api/current/index.mjs",
      node_args: "--env-file=/root/featuretree/shared/.env",
      env: { NODE_ENV: "production", PORT: "18914", HOST: "127.0.0.1", STUDIO_DATA_DIR: "/root/featuretree/api/data" },
      max_memory_restart: "300M",
      out_file: "/root/featuretree/api/logs/out.log",
      error_file: "/root/featuretree/api/logs/error.log",
      time: true,
    },
  ],
}
