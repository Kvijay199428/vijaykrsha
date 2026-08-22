export interface Env {
  API_ORIGIN: string;
}

const ALLOWED_ORIGINS = [
  "https://vijaykrsha.online",
  "https://vijaykrsha-website.pages.dev",
];

function corsHeaders(origin: string | null): Record<string, string> {
  // Only reflect an allowlisted origin. Unknown origins get NO CORS headers,
  // so browsers block any cross-origin read of the response.
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
    return {};
  }
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-CSRF-Token",
    "Access-Control-Expose-Headers": "X-RateLimit-RetryAfter",
    "Access-Control-Max-Age": "86400",
  };
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request } = context;
  const origin = request.headers.get("Origin");

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\//, "/");

  const backendUrl = new URL(path, context.env.API_ORIGIN || "https://api.vijaykrsha.online");
  backendUrl.search = url.search;

  const proxyRequest = new Request(backendUrl.toString(), {
    method: request.method,
    headers: request.headers,
    body: request.body,
    redirect: "follow",
  });

  proxyRequest.headers.delete("Origin");
  proxyRequest.headers.delete("Referer");
  // Trust headers are set only by this proxy; never accept client-supplied ones.
  proxyRequest.headers.delete("X-Forwarded-By");
  proxyRequest.headers.delete("X-Original-Origin");
  proxyRequest.headers.set("X-Forwarded-By", "pages-proxy");
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    proxyRequest.headers.set("X-Original-Origin", origin);
  }

  const response = await fetch(proxyRequest);
  const newResponse = new Response(response.body, response);

  // Belt-and-braces: some runtimes collapse multiple Set-Cookie headers when
  // copying a Response. Re-append each explicitly so the session cookie can
  // never be lost between backend and browser.
  const upstreamCookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [];
  for (const cookie of upstreamCookies) {
    newResponse.headers.append("set-cookie", cookie);
  }

  for (const [key, value] of Object.entries(corsHeaders(origin))) {
    newResponse.headers.set(key, value);
  }

  return newResponse;
};
