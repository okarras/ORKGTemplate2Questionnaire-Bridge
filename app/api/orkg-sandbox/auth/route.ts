import { NextRequest, NextResponse } from "next/server";

/**
 * ORKG uses Keycloak for authentication.
 * Token endpoint: POST https://accounts.orkg.org/realms/orkg/protocol/openid-connect/token
 * Grant type: password (Resource Owner Password Credentials)
 * Client ID: orkg-client (the public client used for direct API access)
 *
 * Reference: empire-Compass/.env.example
 *   VITE_KEYCLOAK_URL=https://accounts.orkg.org
 *   VITE_KEYCLOAK_REALM=orkg
 */
const KEYCLOAK_TOKEN_URL =
  "https://accounts.orkg.org/realms/orkg/protocol/openid-connect/token";
// Public client — no client_secret required
const KEYCLOAK_CLIENT_ID = "orkg-client";

/**
 * POST /api/orkg-sandbox/auth
 * Body: { email: string; password: string }
 *
 * Exchanges user credentials for an ORKG Keycloak bearer token via the
 * OAuth2 Resource Owner Password Credentials grant.
 * Proxied server-side to avoid CORS issues from the browser.
 */
export async function POST(request: NextRequest) {
  let body: { email?: string; password?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json(
      { error: "email and password are required" },
      { status: 400 },
    );
  }

  try {
    // Keycloak password grant — must be form-encoded, not JSON
    const params = new URLSearchParams({
      grant_type: "password",
      client_id: KEYCLOAK_CLIENT_ID,
      username: email.trim(),
      password,
      scope: "openid",
    });

    const tokenRes = await fetch(KEYCLOAK_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: params.toString(),
    });

    if (!tokenRes.ok) {
      const errData = await tokenRes.json().catch(() => ({}));
      const detail =
        errData.error_description ||
        errData.error ||
        `HTTP ${tokenRes.status}`;

      return NextResponse.json(
        { error: "Authentication failed", detail },
        { status: tokenRes.status === 401 ? 401 : 502 },
      );
    }

    const data = await tokenRes.json();
    const access_token: string | undefined = data.access_token;

    if (!access_token) {
      return NextResponse.json(
        { error: "No access_token in Keycloak response", detail: JSON.stringify(data) },
        { status: 502 },
      );
    }

    return NextResponse.json({ access_token });
  } catch (err) {
    return NextResponse.json(
      { error: "Network error reaching Keycloak", detail: String(err) },
      { status: 502 },
    );
  }
}
