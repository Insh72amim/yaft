import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const webDir = path.join(rootDir, 'apps', 'web');
const apiRouteDir = path.join(webDir, 'app', 'api');
const apiBackupDir = path.join(webDir, '.api-route-backup');
const demoOutDir = path.join(webDir, '.next-demo');
const targetMktDir = process.env.YAFT_MKT_DIR || path.resolve(rootDir, '..', 'yaft-mkt');
const marketingDemoDir = path.join(targetMktDir, 'demo');
const marketingLogosDir = path.join(targetMktDir, 'logos');
const webLogosDir = path.join(webDir, 'public', 'logos');

console.log('Building static Guest Demo export of @yaft/web...');

let movedApiRoute = false;
try {
  if (fs.existsSync(apiRouteDir)) {
    if (fs.existsSync(apiBackupDir)) {
      fs.rmSync(apiBackupDir, { recursive: true, force: true });
    }
    fs.renameSync(apiRouteDir, apiBackupDir);
    movedApiRoute = true;
  }

  if (fs.existsSync(demoOutDir)) {
    fs.rmSync(demoOutDir, { recursive: true, force: true });
  }

  execSync('npm run build --workspace @yaft/web', {
    cwd: rootDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      NEXT_PUBLIC_DEMO_MODE: 'true',
      NEXT_PUBLIC_DEMO_EXPORT: 'true',
    },
  });

  if (!fs.existsSync(demoOutDir)) {
    throw new Error(`Expected static export directory at ${demoOutDir}`);
  }

  fs.rmSync(marketingDemoDir, { recursive: true, force: true });
  fs.cpSync(demoOutDir, marketingDemoDir, { recursive: true });

  if (fs.existsSync(webLogosDir)) {
    fs.rmSync(marketingLogosDir, { recursive: true, force: true });
    fs.cpSync(webLogosDir, marketingLogosDir, { recursive: true });
  }

  console.log(`Successfully exported interactive Guest Demo to ${marketingDemoDir}`);
} finally {
  if (movedApiRoute && fs.existsSync(apiBackupDir)) {
    if (fs.existsSync(apiRouteDir)) {
      fs.rmSync(apiRouteDir, { recursive: true, force: true });
    }
    fs.renameSync(apiBackupDir, apiRouteDir);
  }
  if (fs.existsSync(demoOutDir)) {
    fs.rmSync(demoOutDir, { recursive: true, force: true });
  }
}
