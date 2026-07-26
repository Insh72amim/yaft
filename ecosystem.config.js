module.exports = {
  apps: [
    {
      name: "yaft-api",
      script: "npm",
      args: "run start:dev --workspace @yaft/api",
      cwd: "./",
    },
    {
      name: "yaft-web",
      script: "npm",
      args: "run dev --workspace @yaft/web",
      cwd: "./",
    },
  ],
};
