module.exports = {
  apps: [
    {
      name: "yaft-api",
      script: "bash",
      args: '-c "npm run start:dev --workspace @yaft/api"',
      cwd: "./",
    },
    {
      name: "yaft-web",
      script: "bash",
      args: '-c "npm run build && npx next dev"',
      cwd: "./",
    },
  ],
};
