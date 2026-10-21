export interface Env {
  ASSETS: Fetcher;
}

// The apps catalogue is canonical on its own subdomain.
//
// Pages' `_redirects` file cannot express a host condition: every rule in it
// applies to every hostname attached to the project. A host-agnostic
// `/apps -> apps.vijaykrsha.online/apps` rule would therefore also fire on
// the subdomain itself and redirect the page to itself, forever.
//
// A Function route is the one place where the Host header is available.
// Requests served by a Function skip the `_redirects` rules entirely, so this
// route owns `/apps` on every host of the project.
const APPS_HOST = "apps.vijaykrsha.online";
const APPS_URL = `https://${APPS_HOST}/apps`;

// Hosts whose `/apps` belongs on the apps subdomain. Everything else (the
// per-deployment *.pages.dev preview hosts) keeps serving the page locally.
const CANONICAL_HOSTS = ["vijaykrsha.online", "www.vijaykrsha.online"];

function hostOf(request: Request): string {
  const host = request.headers.get("host") || "";
  // Strip the port and normalise case: `Apps.VijayKrsha.online:443`.
  return host.split(":")[0]!.toLowerCase();
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request } = context;

  if (CANONICAL_HOSTS.includes(hostOf(request))) {
    // Keep the query string so deep links survive the hop.
    const url = new URL(request.url);
    const target = url.search ? `${APPS_URL}${url.search}` : APPS_URL;
    return new Response(null, {
      status: 301,
      headers: { location: target },
    });
  }

  // On the apps host (and on preview hosts) serve the SPA shell. The
  // client-side router picks the Apps page up from the /apps path. The
  // asset response carries the `_headers` rules (CSP, cache-control).
  const shell = new URL("/index.html", request.url);
  if (context.env && context.env.ASSETS) {
    return context.env.ASSETS.fetch(new Request(shell));
  }
  // Fall back to the static asset pipeline if the binding is unavailable.
  return context.next();
};
