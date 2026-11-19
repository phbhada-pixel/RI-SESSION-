import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT) || 3000;
const OWNER_EMAIL = 'phbhada@gmail.com';
const POINTER_FILE = path.resolve(__dirname, '.central-sheet-pointer.json');

interface CentralSheetPointer {
  spreadsheetId: string | null;
  spreadsheetUrl: string | null;
  ownerEmail: string;
  sharedWithAnyone: boolean;
  updatedAt: string | null;
}

function readPointer(): CentralSheetPointer {
  try {
    if (fs.existsSync(POINTER_FILE)) {
      const raw = fs.readFileSync(POINTER_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<CentralSheetPointer>;
      if (parsed.spreadsheetId) {
        return {
          spreadsheetId: parsed.spreadsheetId,
          spreadsheetUrl:
            parsed.spreadsheetUrl ||
            `https://docs.google.com/spreadsheets/d/${parsed.spreadsheetId}/edit`,
          ownerEmail: OWNER_EMAIL,
          sharedWithAnyone: Boolean(parsed.sharedWithAnyone),
          updatedAt: parsed.updatedAt || null,
        };
      }
    }
  } catch {
    // ignore corrupted pointer file
  }
  return {
    spreadsheetId: process.env.PHC_CENTRAL_SHEET_ID || null,
    spreadsheetUrl: process.env.PHC_CENTRAL_SHEET_ID
      ? `https://docs.google.com/spreadsheets/d/${process.env.PHC_CENTRAL_SHEET_ID}/edit`
      : null,
    ownerEmail: OWNER_EMAIL,
    sharedWithAnyone: false,
    updatedAt: null,
  };
}

function writePointer(pointer: CentralSheetPointer): void {
  fs.writeFileSync(POINTER_FILE, JSON.stringify(pointer, null, 2), 'utf-8');
}

const AUTH_COOKIE_NAME = 'phc_bhada_ws_session';

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const map: Record<string, string> = {};
  if (!cookieHeader) return map;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) {
      try {
        map[key] = decodeURIComponent(val);
      } catch {
        map[key] = val;
      }
    }
  }
  return map;
}

function isHttpsRequest(req: express.Request): boolean {
  if (req.secure) return true;
  const proto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  return proto.includes('https');
}

function buildCookieAttributes(req: express.Request, maxAgeSeconds: number): string {
  const https = isHttpsRequest(req);
  const parts = [
    `Path=/`,
    `HttpOnly`,
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`,
    `SameSite=${https ? 'None' : 'Lax'}`,
  ];
  if (https) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

interface StoredCookieSession {
  accessToken: string;
  email: string;
  expiresAtMs: number;
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // Persistent HttpOnly cookie session for the short-lived Google OAuth access token
  // so browser reloads do not force Sign in with Google again until explicit logout or token expiry.
  app.get('/api/auth/session', (req, res) => {
    const cookies = parseCookies(req.headers.cookie);
    const raw = cookies[AUTH_COOKIE_NAME];
    if (!raw) {
      res.json({ authenticated: false });
      return;
    }
    try {
      const jsonStr = Buffer.from(raw, 'base64url').toString('utf-8');
      const parsed = JSON.parse(jsonStr) as Partial<StoredCookieSession>;
      if (
        !parsed.accessToken ||
        !parsed.email ||
        !parsed.expiresAtMs ||
        parsed.expiresAtMs <= Date.now() + 30_000
      ) {
        res.setHeader(
          'Set-Cookie',
          `${AUTH_COOKIE_NAME}=; ${buildCookieAttributes(req, 0)}`
        );
        res.json({ authenticated: false });
        return;
      }
      res.json({
        authenticated: true,
        accessToken: parsed.accessToken,
        email: parsed.email,
        expiresAtMs: parsed.expiresAtMs,
      });
    } catch {
      res.setHeader(
        'Set-Cookie',
        `${AUTH_COOKIE_NAME}=; ${buildCookieAttributes(req, 0)}`
      );
      res.json({ authenticated: false });
    }
  });

  app.post('/api/auth/session', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Missing Bearer token' });
        return;
      }
      const accessToken = authHeader.slice('Bearer '.length).trim();
      const tokenInfoRes = await fetch(
        `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${encodeURIComponent(accessToken)}`
      );
      if (!tokenInfoRes.ok) {
        res.status(401).json({ error: 'Invalid Google access token' });
        return;
      }
      const info = (await tokenInfoRes.json()) as {
        email?: string;
        expires_in?: string | number;
      };
      const email = (info.email || '').trim().toLowerCase();
      if (!email) {
        res.status(401).json({ error: 'Token missing email' });
        return;
      }
      const expiresInSec = Math.max(60, Number(info.expires_in) || 3500);
      const expiresAtMs = Date.now() + expiresInSec * 1000;
      const payload: StoredCookieSession = { accessToken, email, expiresAtMs };
      const encoded = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
      res.setHeader(
        'Set-Cookie',
        `${AUTH_COOKIE_NAME}=${encodeURIComponent(encoded)}; ${buildCookieAttributes(req, expiresInSec)}`
      );
      res.json({ authenticated: true, email, expiresAtMs });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to store session cookie',
      });
    }
  });

  app.delete('/api/auth/session', (req, res) => {
    res.setHeader(
      'Set-Cookie',
      `${AUTH_COOKIE_NAME}=; ${buildCookieAttributes(req, 0)}`
    );
    res.json({ authenticated: false });
  });

  // Server-authoritative timestamp & IST date endpoint for 2-day session locking validation
  app.get('/api/server-time', (_req, res) => {
    const now = new Date();
    let todayIST = '';
    try {
      const parts = new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(now);
      const y = parts.find((p) => p.type === 'year')?.value;
      const m = parts.find((p) => p.type === 'month')?.value;
      const d = parts.find((p) => p.type === 'day')?.value;
      if (y && m && d) {
        todayIST = `${y}-${m}-${d}`;
      }
    } catch {
      // Fallback below
    }
    if (!todayIST) {
      const istNow = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
      todayIST = istNow.toISOString().slice(0, 10);
    }
    res.json({ nowISO: now.toISOString(), todayIST });
  });

  // Lightweight pointer endpoint storing ONLY the central Google Sheet ID of phbhada@gmail.com
  // (No clinical, beneficiary, or user records are ever stored on the server.)
  app.get('/api/central-sheet', (_req, res) => {
    res.json(readPointer());
  });

  app.post('/api/central-sheet', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Missing Bearer token' });
        return;
      }
      const token = authHeader.slice('Bearer '.length).trim();
      const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!userInfoRes.ok) {
        res.status(401).json({ error: 'Invalid Google access token' });
        return;
      }
      const userInfo = (await userInfoRes.json()) as { email?: string };
      const callerEmail = (userInfo.email || '').toLowerCase();
      if (callerEmail !== OWNER_EMAIL) {
        res.status(403).json({
          error: `Only ${OWNER_EMAIL} can register or change the central PHC Bhada Google Sheet.`,
        });
        return;
      }

      const { spreadsheetId, spreadsheetUrl, sharedWithAnyone } = req.body as {
        spreadsheetId?: string;
        spreadsheetUrl?: string;
        sharedWithAnyone?: boolean;
      };

      if (!spreadsheetId || !/^[a-zA-Z0-9_-]{10,128}$/.test(spreadsheetId)) {
        res.status(400).json({ error: 'Invalid spreadsheetId' });
        return;
      }

      const current = readPointer();
      const updated: CentralSheetPointer = {
        spreadsheetId,
        spreadsheetUrl:
          spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
        ownerEmail: OWNER_EMAIL,
        sharedWithAnyone:
          typeof sharedWithAnyone === 'boolean' ? sharedWithAnyone : current.sharedWithAnyone,
        updatedAt: new Date().toISOString(),
      };
      writePointer(updated);
      res.json(updated);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to save central sheet pointer',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PHC Bhada server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
