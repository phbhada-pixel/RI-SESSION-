import { initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
] as const;

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Keep Firebase Auth session persisted in browser until explicit logout
void setPersistence(auth, browserLocalPersistence).catch(() => undefined);

function buildGoogleProvider(options?: { switchAccount?: boolean; loginHint?: string }) {
  const provider = new GoogleAuthProvider();
  for (const scope of WORKSPACE_SCOPES) {
    provider.addScope(scope);
  }
  const params: Record<string, string> = {};
  if (options?.switchAccount) {
    params.prompt = 'select_account';
  }
  if (options?.loginHint) {
    params.login_hint = options.loginHint;
  }
  if (Object.keys(params).length > 0) {
    provider.setCustomParameters(params);
  }
  return provider;
}

// In-memory OAuth access token cache + server HttpOnly cookie restoration (never localStorage/sessionStorage)
let isSigningIn = false;
let cachedAccessToken: string | null = null;
let cachedTokenExpiresAtMs = 0;

async function persistSessionCookie(accessToken: string): Promise<void> {
  try {
    const res = await fetch('/api/auth/session', {
      method: 'POST',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    const ct = res.headers.get('content-type') || '';
    if (res.ok && ct.includes('application/json')) {
      const data = (await res.json()) as { expiresAtMs?: number };
      if (data.expiresAtMs) {
        cachedTokenExpiresAtMs = data.expiresAtMs;
      }
    }
  } catch {
    // Ignore network failures; in-memory token still works for current tab
  }
}

async function restoreSessionCookie(expectedEmail?: string | null): Promise<string | null> {
  try {
    const res = await fetch('/api/auth/session', {
      method: 'GET',
      credentials: 'include',
    });
    const ct = res.headers.get('content-type') || '';
    if (!res.ok || !ct.includes('application/json')) return null;
    const data = (await res.json()) as {
      authenticated?: boolean;
      accessToken?: string;
      email?: string;
      expiresAtMs?: number;
    };
    if (!data.authenticated || !data.accessToken) return null;
    if (
      expectedEmail &&
      data.email &&
      expectedEmail.trim().toLowerCase() !== data.email.trim().toLowerCase()
    ) {
      return null;
    }
    cachedAccessToken = data.accessToken;
    cachedTokenExpiresAtMs = data.expiresAtMs || 0;
    return cachedAccessToken;
  } catch {
    return null;
  }
}

async function clearSessionCookie(): Promise<void> {
  try {
    await fetch('/api/auth/session', {
      method: 'DELETE',
      credentials: 'include',
    });
  } catch {
    // ignore
  }
}

export function initGoogleAuthListener(
  onAuthSuccess: (user: User, token: string) => void,
  onNeedsAuth: (user: User | null) => void
) {
  let disposed = false;
  const unsub = onAuthStateChanged(auth, (fbUser) => {
    void (async () => {
      if (disposed) return;
      if (fbUser) {
        if (
          cachedAccessToken &&
          (!cachedTokenExpiresAtMs || cachedTokenExpiresAtMs > Date.now() + 30_000)
        ) {
          onAuthSuccess(fbUser, cachedAccessToken);
          return;
        }
        if (isSigningIn) return;
        const restored = await restoreSessionCookie(fbUser.email);
        if (disposed) return;
        if (restored) {
          onAuthSuccess(fbUser, restored);
        } else {
          cachedAccessToken = null;
          cachedTokenExpiresAtMs = 0;
          onNeedsAuth(fbUser);
        }
      } else {
        cachedAccessToken = null;
        cachedTokenExpiresAtMs = 0;
        onNeedsAuth(null);
      }
    })();
  });
  return () => {
    disposed = true;
    unsub();
  };
}

export async function signInWithGoogleWorkspace(options?: {
  switchAccount?: boolean;
  loginHint?: string;
}): Promise<{
  user: User;
  accessToken: string;
}> {
  try {
    isSigningIn = true;
    await setPersistence(auth, browserLocalPersistence).catch(() => undefined);
    const hint = options?.loginHint ?? (!options?.switchAccount ? auth.currentUser?.email || undefined : undefined);
    const provider = buildGoogleProvider({
      switchAccount: options?.switchAccount,
      loginHint: hint,
    });
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Google Sheets आणि Drive साठी Access Token मिळाला नाही.');
    }
    cachedAccessToken = credential.accessToken;
    cachedTokenExpiresAtMs = Date.now() + 55 * 60 * 1000;
    await persistSessionCookie(cachedAccessToken);
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
}

export function getInMemoryAccessToken(): string | null {
  return cachedAccessToken;
}

export function clearInMemoryAccessToken(): void {
  cachedAccessToken = null;
  cachedTokenExpiresAtMs = 0;
  void clearSessionCookie();
}

export async function signOutGoogleWorkspace(): Promise<void> {
  cachedAccessToken = null;
  cachedTokenExpiresAtMs = 0;
  await clearSessionCookie();
  await auth.signOut();
}
