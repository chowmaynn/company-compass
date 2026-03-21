const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = `${window.location.origin}/oauth/callback`;
const TOKEN_KEY = "google_oauth_tokens";

const SCOPES = [
  "https://www.googleapis.com/auth/yt-analytics.readonly",
  "https://www.googleapis.com/auth/analytics.readonly",
];

export interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  expires_at: number; // epoch ms
}

export function getAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeCode(code: string): Promise<OAuthTokens> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error_description || "Token exchange failed");
  }

  const data = await res.json();
  const tokens: OAuthTokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };

  saveTokens(tokens);
  return tokens;
}

async function refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    clearTokens();
    throw new Error("Failed to refresh token — please re-authorize");
  }

  const data = await res.json();
  const tokens: OAuthTokens = {
    access_token: data.access_token,
    refresh_token: refreshToken,
    expires_at: Date.now() + data.expires_in * 1000,
  };

  saveTokens(tokens);
  return tokens;
}

export async function getValidAccessToken(): Promise<string | null> {
  const tokens = getTokens();
  if (!tokens) return null;

  // Refresh if expiring in the next 60 seconds
  if (Date.now() > tokens.expires_at - 60_000) {
    if (!tokens.refresh_token) {
      clearTokens();
      return null;
    }
    const refreshed = await refreshAccessToken(tokens.refresh_token);
    return refreshed.access_token;
  }

  return tokens.access_token;
}

export function getTokens(): OAuthTokens | null {
  const raw = localStorage.getItem(TOKEN_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveTokens(tokens: OAuthTokens) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
}

export function isAuthorized(): boolean {
  return getTokens() !== null;
}
