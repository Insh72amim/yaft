const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

module.exports = {
  apps: [
    {
      name: "yaft-api",
      cwd: path.resolve(__dirname),
      script: "npm",
      args: "run start:dev --workspace @yaft/api",
      interpreter: "none",
      env: {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL || "postgresql://yaft:yaft-development-only@127.0.0.1:5432/yaft_finance?schema=public",
        JWT_SECRET: process.env.JWT_SECRET || "<REDACTED_JWT_SECRET>",
        YAFT_CREDENTIAL_ENCRYPTION_KEY: process.env.YAFT_CREDENTIAL_ENCRYPTION_KEY || "<REDACTED_ENCRYPTION_KEY>",
        S3_ENDPOINT: process.env.S3_ENDPOINT || "http://localhost:9000",
        S3_REGION: process.env.S3_REGION || "us-east-1",
        S3_ACCESS_KEY: process.env.S3_ACCESS_KEY || "minioadmin",
        S3_SECRET_KEY: process.env.S3_SECRET_KEY || "minioadmin",
        S3_BUCKET: process.env.S3_BUCKET || "yaft-documents",
        WEB_ORIGIN: process.env.WEB_ORIGIN || "http://localhost:3000",
        API_PORT: process.env.API_PORT || 4000,
        PORT: process.env.API_PORT || 4000,
        NODE_ENV: "development",
      },
    },
    {
      name: "yaft-web",
      cwd: path.resolve(__dirname),
      script: "npm",
      args: "run dev --workspace @yaft/web",
      interpreter: "none",
      env: {
        ...process.env,
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api",
        PORT: 3000,
        NODE_ENV: "development",
      },
    },
  ],
};

