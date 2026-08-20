export interface Env {
  API_ORIGIN: string;
}

const ALLOWED_ORIGINS = [
  "https://vijaykrsha.online",
  "https://vijaykrsha-website.pages.dev",
];

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = ALLOWED_ORIGINS.includes(origin || "")
    ? origin!
    : ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
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
  const path = url.searchParams.get("__proxy_path") || url.pathname.replace(/^\/api\//, "/");

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
  proxyRequest.headers.set("X-Forwarded-By", "pages-proxy");

  const response = await fetch(proxyRequest);
  const newResponse = new Response(response.body, response);
  const headers = corsHeaders(origin);

  for (const [key, value] of Object.entries(headers)) {
    newResponse.headers.set(key, value);
  }

  return newResponse;
};
