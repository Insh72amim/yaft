const path = require("path");

module.exports = {
  apps: [
    {
      name: "yaft-api",
      cwd: path.resolve(__dirname),
      script: "npm",
      args: "run start:dev --workspace @yaft/api",
      env: {
        NODE_ENV: "development",
      },
    },
    {
      name: "yaft-web",
      cwd: path.resolve(__dirname),
      script: "npm",
      args: "run dev --workspace @yaft/web",
      env: {
        NODE_ENV: "development",
      },
    },
  ],
};
