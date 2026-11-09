const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

module.exports = {
  apps: [
    {
      name: "yaft-api",
      cwd: path.resolve(__dirname, "apps/api"),
      script: "../../node_modules/.bin/nest",
      args: "start --watch",
      kill_timeout: 4000,
      env: {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL,
        JWT_SECRET: process.env.JWT_SECRET,
        YAFT_CREDENTIAL_ENCRYPTION_KEY: process.env.YAFT_CREDENTIAL_ENCRYPTION_KEY,
        S3_ENDPOINT: process.env.S3_ENDPOINT || "http://localhost:9000",
        S3_REGION: process.env.S3_REGION || "us-east-1",
        S3_ACCESS_KEY: process.env.S3_ACCESS_KEY || "minioadmin",
        S3_SECRET_KEY: process.env.S3_SECRET_KEY || "minioadmin",
        S3_BUCKET: process.env.S3_BUCKET || "yaft-documents",
        WEB_ORIGIN: process.env.WEB_ORIGIN || "http://yaft.localhub.com,http://localhost:3001,http://127.0.0.1:3001",
        API_PORT: process.env.API_PORT || 4001,
        PORT: process.env.API_PORT || 4001,
        NODE_ENV: "development",
      },
    },
    {
      name: "yaft-web",
      cwd: path.resolve(__dirname, "apps/web"),
      script: "../../node_modules/.bin/next",
      args: "dev -p 3001",
      kill_timeout: 4000,
      env: {
        ...process.env,
        YAFT_API_INTERNAL_URL: process.env.YAFT_API_INTERNAL_URL || "http://127.0.0.1:4001",
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "http://api.yaft.localhub.com/api",
        PORT: 3001,
        NODE_ENV: "development",
      },
    },
  ],
};


