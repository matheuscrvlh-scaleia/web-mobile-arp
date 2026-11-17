/** API do RD Station Marketing (OAuth do app "ARP ControlApp"). */
const API_URL = "https://api.rd.services";
const TIMEOUT_MS = 15_000;

/** Resposta de erro do RD (status null = sem resposta: rede ou timeout). */
export class RdApiError extends Error {
  override readonly name = "RdApiError";
  constructor(
    readonly status: number | null,
    message: string,
  ) {
    super(message);
  }
}

export interface RdAppCredentials {
  clientId: string;
  clientSecret: string;
}

/** Primeira mensagem de erro do corpo do RD ({ errors: { error_message } } e variações). */
function errorText(body: unknown): string | null {
  const m = JSON.stringify(body ?? null).match(/"(?:error_message|message|error)":"([^"]{1,300})"/);
  return m?.[1] ?? null;
}

async function call(
  path: string,
  init: { method?: string; token?: string; body?: unknown },
): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: init.method ?? "GET",
      headers: {
        "content-type": "application/json",
        ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
      },
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new RdApiError(null, "O RD Station não respondeu");
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    throw new RdApiError(res.status, errorText(body) ?? `O RD Station respondeu ${res.status}`);
  }
  return body;
}

function field(body: unknown, key: string): string | null {
  const v = (body as Record<string, unknown> | null)?.[key];
  return typeof v === "string" && v ? v : null;
}

export const rdStationApi = {
  /** Troca o code da autorização (uma vez, ~1 hora) pelo refresh token. */
  async exchangeCode(app: RdAppCredentials, code: string): Promise<string> {
    const body = await call("/auth/token?token_by=code", {
      method: "POST",
      body: { client_id: app.clientId, client_secret: app.clientSecret, code },
    });
    const refresh = field(body, "refresh_token");
    if (!refresh) throw new RdApiError(null, "O RD não devolveu o refresh token");
    return refresh;
  },

  /** Access token novo (vale ~1 dia). O RD pode devolver outro refresh token. */
  async refresh(
    app: RdAppCredentials,
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string | null }> {
    const body = await call("/auth/token", {
      method: "POST",
      body: {
        client_id: app.clientId,
        client_secret: app.clientSecret,
        refresh_token: refreshToken,
      },
    });
    const accessToken = field(body, "access_token");
    if (!accessToken) throw new RdApiError(null, "O RD não devolveu o access token");
    return { accessToken, refreshToken: field(body, "refresh_token") };
  },

  /** Nome da conta que autorizou o app (serve de teste da conexão). */
  async accountName(accessToken: string): Promise<string> {
    const body = await call("/marketing/account_info", { token: accessToken });
    return field(body, "name") ?? "sem nome";
  },

  async sendConversion(
    accessToken: string,
    lead: { conversion: string; name: string; email: string },
  ): Promise<void> {
    await call("/platform/conversions", {
      method: "POST",
      token: accessToken,
      body: {
        event_type: "CONVERSION",
        event_family: "CDP",
        payload: {
          conversion_identifier: lead.conversion,
          name: lead.name,
          email: lead.email,
          legal_bases: [{ category: "communications", type: "consent", status: "granted" }],
        },
      },
    });
  },
};
