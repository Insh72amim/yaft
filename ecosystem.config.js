const path = require("path");

module.exports = {
  apps: [
    {
      name: "yaft-api",
      cwd: path.resolve(__dirname),
      script: "npm",
      args: "run start:dev --workspace @yaft/api",
      interpreter: "none",
    },
    {
      name: "yaft-web",
      cwd: path.resolve(__dirname),
      script: "npm",
      args: "run dev --workspace @yaft/web",
      interpreter: "none",
    },
  ],
};
