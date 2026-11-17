import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
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

const provider = new GoogleAuthProvider();
for (const scope of WORKSPACE_SCOPES) {
  provider.addScope(scope);
}
provider.setCustomParameters({
  prompt: 'select_account',
});

// In-memory OAuth access token cache only (never stored in localStorage or sessionStorage)
let isSigningIn = false;
let cachedAccessToken: string | null = null;

export function initGoogleAuthListener(
  onAuthSuccess: (user: User, token: string) => void,
  onNeedsAuth: (user: User | null) => void
) {
  return onAuthStateChanged(auth, (fbUser) => {
    if (fbUser) {
      if (cachedAccessToken) {
        onAuthSuccess(fbUser, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        onNeedsAuth(fbUser);
      }
    } else {
      cachedAccessToken = null;
      onNeedsAuth(null);
    }
  });
}

export async function signInWithGoogleWorkspace(): Promise<{
  user: User;
  accessToken: string;
}> {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Google Sheets आणि Drive साठी Access Token मिळाला नाही.');
    }
    cachedAccessToken = credential.accessToken;
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
}

export async function signOutGoogleWorkspace(): Promise<void> {
  cachedAccessToken = null;
  await auth.signOut();
}
