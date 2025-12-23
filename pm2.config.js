module.exports = {
  apps: [
    {
      name: "rsacrmcasemanagement",
      script: "./build/index.js",
      instances: 1,
      exec_mode: "cluster",
      autorestart: true,
      watch: false,
      time: true,
      max_memory_restart: "1G",
      exp_backoff_restart_delay: 200,
      node_args: ["--max-old-space-size=2048", "--heapsnapshot-signal=SIGUSR2"],
    },
  ],
};
