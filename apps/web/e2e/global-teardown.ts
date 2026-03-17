import fs from 'fs';
import path from 'path';

export default async function globalTeardown() {
  const dbUrlFile = path.join(__dirname, '..', '.e2e-db-url');
  const backendUrlFile = path.join(__dirname, '..', '.e2e-backend-url');
  if (fs.existsSync(dbUrlFile)) {
    try {
      const dbPath = fs.readFileSync(dbUrlFile, 'utf-8').trim();
      if (dbPath) {
        for (const suffix of ['', '-shm', '-wal']) {
          const target = `${dbPath}${suffix}`;
          if (fs.existsSync(target)) {
            fs.unlinkSync(target);
          }
        }
      }
    } catch {}
  }

  if (fs.existsSync(dbUrlFile)) {
    try {
      fs.unlinkSync(dbUrlFile);
    } catch {}
  }

  if (fs.existsSync(backendUrlFile)) {
    try {
      fs.unlinkSync(backendUrlFile);
    } catch {}
  }
}

