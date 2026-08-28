// Cliente mínimo (fetch puro, sem SDK "googleapis") para OAuth + Google
// Sheets API v4. Só pedimos o scope "spreadsheets" — nunca "drive" — porque
// a própria API de Sheets já cria o ficheiro (spreadsheets.create), o que
// evita pedir um scope mais sensível do que o necessário.

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

export function getOAuthClientConfig() {
  const clientId = process.env.GOOGLE_SHEETS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_SHEETS_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_SHEETS_CLIENT_ID / GOOGLE_SHEETS_CLIENT_SECRET não estão configurados.");
  }
  return { clientId, clientSecret };
}

export function buildAuthUrl(redirectUri: string, state: string) {
  const { clientId } = getOAuthClientConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.email",
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string, redirectUri: string) {
  const { clientId, clientSecret } = getOAuthClientConfig();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Falha ao trocar código por token: ${await res.text()}`);
  return res.json() as Promise<{ access_token: string; refresh_token?: string; expires_in: number; id_token?: string }>;
}

export async function refreshAccessToken(refreshToken: string) {
  const { clientId, clientSecret } = getOAuthClientConfig();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Falha ao renovar o token de acesso Google: ${await res.text()}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  return data.access_token;
}

export async function fetchGoogleUserEmail(accessToken: string) {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return (data.email as string) ?? null;
}

async function sheetsFetch(accessToken: string, path: string, init?: RequestInit) {
  const res = await fetch(`${SHEETS_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Sheets API (${res.status}): ${body}`);
  }
  return res.json();
}

export async function createSpreadsheet(accessToken: string, title: string, sheetTitles: string[]) {
  const body = {
    properties: { title },
    sheets: sheetTitles.map((t, i) => ({ properties: { sheetId: i, title: t, gridProperties: { frozenRowCount: 1 } } })),
  };
  const data = await sheetsFetch(accessToken, "", { method: "POST", body: JSON.stringify(body) });
  return { spreadsheetId: data.spreadsheetId as string, sheets: data.sheets as any[] };
}

export async function updateValues(accessToken: string, spreadsheetId: string, range: string, values: unknown[][]) {
  await sheetsFetch(
    accessToken,
    `/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    { method: "PUT", body: JSON.stringify({ values }) }
  );
}

export async function appendValues(accessToken: string, spreadsheetId: string, range: string, values: unknown[][]) {
  const data = await sheetsFetch(
    accessToken,
    `/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    { method: "POST", body: JSON.stringify({ values }) }
  );
  return data.updates as { updatedRange: string };
}

export async function batchUpdate(accessToken: string, spreadsheetId: string, requests: unknown[]) {
  return sheetsFetch(accessToken, `/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({ requests }),
  });
}
