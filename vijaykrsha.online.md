```yaml
// File: .cloudflare\config.yml
ingress:
  - hostname: api.vijaykrsha.online
    service: http://localhost:8000
  - service: http_status:404
```

```
// File: .env.example
# Database
POSTGRES_PASSWORD=<generate-a-strong-random-password>
DATABASE_URL=postgresql+asyncpg://postgres:<same-password>@db:5432/vijaykrsha

# Telegram
TELEGRAM_BOT_TOKEN=<from-@BotFather-rotate-if-ever-committed>
TELEGRAM_ADMIN_CHAT_ID=<your-chat-id>

# Security
TOTP_ENCRYPTION_KEY=<run: python -c "import secrets; print(secrets.token_urlsafe(48))">
OTP_PEPPER=<run: python -c "import secrets; print(secrets.token_urlsafe(32))">
PRODUCTION=false
S3_ENDPOINT=http://storage:9000
S3_BUCKET=vijaykrsha-private

# CORS
CORS_ORIGINS=https://vijaykrsha.online,https://vijaykrsha-website.pages.dev
```

```yaml
// File: docker-compose.dev.yml
services:
  database-dev:
    image: postgres:16-alpine
    container_name: database-dev
    restart: unless-stopped
    environment:
      POSTGRES_DB: vijaykrsha_dev
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_DEV_PASSWORD}
    volumes:
      - postgres_dev_data:/var/lib/postgresql/data
    ports:
      - "127.0.0.1:27003:5432"
    networks:
      - dev-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d vijaykrsha_dev"]
      interval: 5s
      timeout: 5s
      retries: 5

  storage-dev:
    image: minio/minio:latest
    container_name: storage-dev
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_DEV_ACCESS_KEY}
      MINIO_ROOT_PASSWORD: ${MINIO_DEV_SECRET_KEY}
    volumes:
      - minio_dev_data:/data
    ports:
      - "127.0.0.1:27002:9000"
    networks:
      - dev-network

  redis-dev:
    image: redis:7-alpine
    container_name: redis-dev
    restart: unless-stopped
    command: redis-server --maxmemory 64mb --maxmemory-policy allkeys-lru
    ports:
      - "127.0.0.1:27004:6379"
    networks:
      - dev-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend-dev:
    build:
      context: ./backend
      dockerfile: Dockerfile.dev
    container_name: backend-dev
    restart: unless-stopped
    depends_on:
      database-dev:
        condition: service_healthy
      storage-dev:
        condition: service_started
      redis-dev:
        condition: service_healthy
    ports:
      - "26001:8000"
    env_file:
      - ./env/.env.dev
    networks:
      - dev-network

  frontend-dev:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: frontend-dev
    restart: unless-stopped
    ports:
      - "26002:80"
    depends_on:
      - backend-dev
    networks:
      - dev-network

volumes:
  postgres_dev_data:
  minio_dev_data:

networks:
  dev-network:
    name: vijaykrsha-dev
```

```yaml
// File: docker-compose.prod.yml
services:
  database-prod:
    image: postgres:16-alpine
    container_name: database-prod
    restart: unless-stopped
    environment:
      POSTGRES_DB: vijaykrsha
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set}
    volumes:
      - vijaykrshaonline_pgdata:/var/lib/postgresql/data
    networks:
      - prod-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d vijaykrsha"]
      interval: 5s
      timeout: 5s
      retries: 5

  storage-prod:
    image: minio/minio:latest
    container_name: storage-prod
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_PROD_ACCESS_KEY}
      MINIO_ROOT_PASSWORD: ${MINIO_PROD_SECRET_KEY}
    volumes:
      - vijaykrshaonline_miniodata:/data
    networks:
      - prod-network

  redis-prod:
    image: redis:7-alpine
    container_name: redis-prod
    restart: unless-stopped
    command: redis-server --maxmemory 128mb --maxmemory-policy allkeys-lru
    networks:
      - prod-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend-prod:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: backend-prod
    restart: unless-stopped
    depends_on:
      database-prod:
        condition: service_healthy
      storage-prod:
        condition: service_started
      redis-prod:
        condition: service_healthy
    ports:
      - "26011:8000"
    env_file:
      - ./env/.env.prod
    environment:
      PRODUCTION: "true"
    networks:
      - prod-network

volumes:
  vijaykrshaonline_pgdata:
    external: true
  vijaykrshaonline_miniodata:
    external: true

networks:
  prod-network:
    name: vijaykrsha-prod
```

```yaml
// File: docker-compose.yml
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: vijaykrsha
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set}
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "127.0.0.1:5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  storage:
    image: minio/minio:latest
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY:-minioadmin}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY:-minioadmin}
    volumes:
      - miniodata:/data
    ports:
      - "127.0.0.1:9000:9000"
      - "127.0.0.1:9001:9001"
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --maxmemory 128mb --maxmemory-policy allkeys-lru
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build: ./backend
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
      storage:
        condition: service_healthy
      redis:
        condition: service_healthy
    ports:
      - "127.0.0.1:8000:8000"
    environment:
      DATABASE_URL: postgresql+asyncpg://postgres:${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set}@db:5432/vijaykrsha
      TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN}
      TELEGRAM_ADMIN_CHAT_ID: ${TELEGRAM_ADMIN_CHAT_ID}
      TOTP_ENCRYPTION_KEY: ${TOTP_ENCRYPTION_KEY:?TOTP_ENCRYPTION_KEY must be set}
      OTP_PEPPER: ${OTP_PEPPER:-vijaykrsha-otp-pepper-change-me}
      REDIS_URL: redis://redis:6379/0
      S3_ENDPOINT: http://storage:9000
      S3_ACCESS_KEY: ${MINIO_ACCESS_KEY:-minioadmin}
      S3_SECRET_KEY: ${MINIO_SECRET_KEY:-minioadmin}
      CORS_ORIGINS: ${CORS_ORIGINS:-http://localhost:5173,https://vijaykrsha.online}

  frontend:
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "3000:80"
    depends_on:
      - backend

volumes:
  pgdata:
  miniodata:
```

```
// File: Dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

```typescript
// File: functions\api\[[path]].ts
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

  // Deterministic Set-Cookie passthrough: the Response copy-constructor may
  // or may not preserve multiplicity depending on runtime. Strip whatever
  // survived the copy and re-append each upstream cookie exactly once.
  if (typeof response.headers.getSetCookie === "function") {
    const upstreamCookies = response.headers.getSetCookie();
    if (upstreamCookies.length > 0) {
      newResponse.headers.delete("set-cookie");
      for (const cookie of upstreamCookies) {
        newResponse.headers.append("set-cookie", cookie);
      }
    }
  }

  for (const [key, value] of Object.entries(corsHeaders(origin))) {
    newResponse.headers.set(key, value);
  }

  return newResponse;
};
```

```conf
// File: nginx.conf
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;
    gzip_min_length 256;

    # --- Security headers ---
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://api.vijaykrsha.online; media-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'" always;

    location / {
        # HTML documents and SPA fallback must never be cached: prevents the
        # Back button restoring an authenticated admin view after logout.
        add_header Cache-Control "no-store" always;
        try_files $uri $uri/ /index.html;
    }

    # Static assets are content-hashed by Vite, so immutable caching is safe.
    # Security headers are repeated here: nginx does not merge add_header
    # directives from parent blocks when a location defines its own.
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header Strict-Transport-Security "max-age=31536000" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Frame-Options "DENY" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;
        add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://api.vijaykrsha.online; media-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'" always;
    }
}
```

```json
// File: package.json
{
  "name": "vijaykrsha-website",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "deploy": "python deploy.py",
    "deploy:docker": "python deploy.py --target docker",
    "deploy:cloudflare": "python deploy.py --target cloudflare",
    "deploy:both": "python deploy.py --target both",
    "deploy:docker:clean": "python deploy.py --target docker --clean",
    "deploy:cf": "python deploy.py --target cloudflare",
    "build:cf": "python cloudflare.py"
  },
  "dependencies": {
    "lucide-react": "^1.32.0",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "react-router-dom": "^7.6.1"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.1.7",
    "@types/react": "^19.1.8",
    "@types/react-dom": "^19.1.6",
    "@vitejs/plugin-react": "^4.5.2",
    "tailwindcss": "^4.1.7",
    "typescript": "~5.8.3",
    "vite": "^6.3.5"
  }
}
```

```
// File: public\_headers
/
  Cache-Control: no-store
/index.html
  Cache-Control: no-store
/vega/*
  Cache-Control: no-store
/assets/*
  Cache-Control: public, max-age=31536000, immutable
```

```
// File: public\_redirects
/* /index.html 200
```

```json
// File: public\logo\logo.json
{
  "src": "/logo/logo.png.gz",
  "fps": 10,
  "frames": 15,
  "frameWidth": 200,
  "frameHeight": 200,
  "opacity": 0.80,
  "blendMode": "normal",
  "loop": true
}
```

```javascript
// File: public\theme-init.js
(function () {
  var stored = null;
  try {
    stored = localStorage.getItem("theme");
  } catch (e) {
    /* storage unavailable */
  }
  if (stored === "dark" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
    document.documentElement.classList.add("dark");
  }
})();
```

```tsx
// File: src\App.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import About from "@/pages/About";
import Freelance from "@/pages/Freelance";
import Portfolio from "@/pages/Portfolio";
import Apps from "@/pages/Apps";
import Contact from "@/pages/Contact";
import NotFound from "@/pages/NotFound";
import AdminLogin from "@/pages/AdminLogin";
import Setup from "@/pages/admin/Setup";
import ProtectedRoute from "@/components/admin/ProtectedRoute";
import AdminLayout from "@/pages/admin/AdminLayout";
import Dashboard from "@/pages/admin/Dashboard";
import Inbox from "@/pages/admin/Inbox";
import MessageDetail from "@/pages/admin/MessageDetail";
import Settings from "@/pages/admin/Settings";
import UsersPage from "@/pages/admin/Users";
import RolesPage from "@/pages/admin/Roles";
import AuditLogs from "@/pages/admin/AuditLogs";

export default function App() {
  return (
    <Routes>
      {/* Public admin routes */}
      <Route path="/vega/admin/login" element={<AdminLogin />} />
      <Route path="/vega/admin/setup" element={<Setup />} />

      {/* Protected admin routes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/vega/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="inbox" element={<Inbox />} />
          <Route path="messages/:id" element={<MessageDetail />} />
          <Route path="settings" element={<Settings />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="roles" element={<RolesPage />} />
          <Route
            path="admin-users"
            element={<Navigate to="/vega/admin/users" replace />}
          />
          <Route path="audit-logs" element={<AuditLogs />} />
        </Route>
      </Route>

      {/* Public site routes */}
      <Route
        path="*"
        element={
          <Layout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/about" element={<About />} />
              <Route path="/freelance" element={<Freelance />} />
              <Route path="/portfolio" element={<Portfolio />} />
              <Route path="/apps" element={<Apps />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Layout>
        }
      />
    </Routes>
  );
}
```

```tsx
// File: src\components\admin\ProtectedRoute.tsx
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

export default function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Checking session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/vega/admin/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  return <Outlet />;
}
```

```tsx
// File: src\components\AnimatedLogo.tsx
import { useRef } from "react";
import useSpriteAnimation from "@/hooks/useSpriteAnimation";
import logoConfig from "../../public/logo/logo.json";

interface AnimatedLogoProps {
  className?: string;
  alt?: string;
  size?: number;
}

export default function AnimatedLogo({
  className = "",
  alt = "Vijay Kumar Sharma",
  size,
}: AnimatedLogoProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const prefersReducedMotion =
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : true;

  const config = {
    ...logoConfig,
    blendMode: logoConfig.blendMode as GlobalCompositeOperation,
  };

  useSpriteAnimation(canvasRef, config);

  const displaySize = size ?? logoConfig.frameWidth;

  if (prefersReducedMotion) {
    return (
      <div
        className={`animated-logo flex items-center justify-center ${className}`}
        style={{ width: displaySize, height: displaySize }}
      >
        <div className="flex items-center justify-center w-full h-full rounded-2xl bg-glow-500/10 border border-glow-500/20">
          <span className="text-3xl font-bold text-glow-600 dark:text-glow-400">
            VK
          </span>
        </div>
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className={`animated-logo ${className}`}
      style={{ width: displaySize, height: displaySize }}
      aria-label={alt}
      role="img"
    />
  );
}
```

```tsx
// File: src\components\Layout.tsx
import { Link, useLocation } from "react-router-dom";
import { useTheme } from "@/context/ThemeContext";
import { site } from "@/config/site";
import { useState, useEffect, useRef } from "react";
import AnimatedLogo from "./AnimatedLogo";

function SunIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function ArrowUpIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
    </svg>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  // Back to top visibility
  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 300);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Scroll reveal
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.1 }
    );

    const elements = document.querySelectorAll(".reveal");
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [location.pathname]);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 bg-cream-50/80 dark:bg-night-900/80 backdrop-blur-md border-b border-cream-200 dark:border-night-700">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="font-bold text-lg text-glow-600 dark:text-glow-400">
            <span className="typing-text">VIJAYKRSHA.ONLINE</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {site.nav.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-link text-sm font-medium rounded-lg px-3 py-1.5 ${
                  location.pathname === item.path
                    ? "text-glow-600 dark:text-glow-400 bg-glow-500/10 dark:bg-glow-400/10"
                    : "text-night-800/70 dark:text-cream-100/70 hover:text-night-800 dark:hover:text-cream-100 hover:bg-cream-200/50 dark:hover:bg-night-700/50"
                }`}
              >
                {item.label}
              </Link>
            ))}
            <button
              onClick={toggle}
              className="p-2 rounded-lg hover:bg-cream-200 dark:hover:bg-night-700 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>
          </nav>

          <div className="flex items-center gap-2 md:hidden">
            <button
              onClick={toggle}
              className="p-2 rounded-lg hover:bg-cream-200 dark:hover:bg-night-700 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-2 rounded-lg hover:bg-cream-200 dark:hover:bg-night-700 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <nav className="md:hidden border-t border-cream-200 dark:border-night-700 bg-cream-50 dark:bg-night-900 px-4 pb-4">
            {site.nav.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={`nav-link block py-3 text-sm font-medium rounded-lg px-3 ${
                  location.pathname === item.path
                    ? "text-glow-600 dark:text-glow-400 bg-glow-500/10 dark:bg-glow-400/10"
                    : "text-night-800/70 dark:text-cream-100/70"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}
      </header>

      <main ref={mainRef} className="flex-1 pb-12">
        {children}
      </main>

      {/* ── Footer ──────────────────────────────── */}
      <footer className="border-t border-cream-200 dark:border-night-700 bg-cream-100 dark:bg-night-800">
        <div className="max-w-6xl mx-auto px-4 pt-12 pb-4">
          {/* Centered Tagline + WhatsApp */}
          <div className="flex flex-col items-center mb-10">
            <p className="font-bold text-lg text-glow-600 dark:text-glow-400 mb-1">
              VIJAYKRSHA.ONLINE
            </p>
            <p className="text-sm text-night-800/50 dark:text-cream-100/50 mb-3">
              Legal Research &bull; Contract Drafting &bull; Legal Technology
            </p>
            <a
              href="https://wa.me/919599130381"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#25D366] text-white text-sm font-medium hover:bg-[#20b858] transition-colors"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Chat on WhatsApp
            </a>
          </div>

          {/* 4-Column Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
            {/* Col 1: Quick Links */}
            <div>
              <p className="footer-heading">Quick Links</p>
              <ul className="space-y-2">
                {site.nav.map((item) => (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      className="text-sm text-night-800/60 dark:text-cream-100/60 hover:text-glow-500 dark:hover:text-glow-400 transition-colors"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Col 2: Services */}
            <div>
              <p className="footer-heading">Services</p>
              <ul className="space-y-2">
                {site.services.map((s) => (
                  <li key={s.title}>
                    <Link
                      to="/freelance"
                      className="text-sm text-night-800/60 dark:text-cream-100/60 hover:text-glow-500 dark:hover:text-glow-400 transition-colors"
                    >
                      {s.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Col 3: Contact */}
            <div>
              <p className="footer-heading">Contact</p>
              <ul className="space-y-2 text-sm text-night-800/60 dark:text-cream-100/60">
                <li>{site.contact.phone}</li>
                <li>{site.contact.email}</li>
                <li>{site.contact.location}</li>
              </ul>
            </div>

            {/* Col 4: Trust */}
            <div>
              <p className="footer-heading">Trust</p>
              <ul className="space-y-2 text-sm text-night-800/60 dark:text-cream-100/60">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-glow-500 shrink-0" />
                  NDA by Default
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-glow-500 shrink-0" />
                  3+ Years Experience
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-glow-500 shrink-0" />
                  Remote Collaboration
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-cream-200 dark:border-night-700 pt-4 flex items-center justify-center gap-3 text-sm text-night-800/50 dark:text-cream-100/50">
            <AnimatedLogo size={100} />
            <p>&copy; {new Date().getFullYear()} {site.name}. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* ── Back to Top ─────────────────────────── */}
      <button
        onClick={scrollToTop}
        aria-label="Back to top"
        className={`back-to-top fixed bottom-6 right-6 z-50 p-3 rounded-full bg-glow-500 text-white shadow-lg hover:bg-glow-600 transition-colors ${showBackToTop ? "show" : ""}`}
      >
        <ArrowUpIcon />
      </button>
    </div>
  );
}
```

```tsx
// File: src\components\OtpDigitInput.tsx
import { useRef, useState, useEffect, useCallback } from "react";

interface OtpDigitInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  autoFocus?: boolean;
  disabled?: boolean;
  error?: boolean;
}

export default function OtpDigitInput({
  value,
  onChange,
  length = 6,
  autoFocus = true,
  disabled = false,
  error = false,
}: OtpDigitInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [digits, setDigits] = useState<string[]>(() =>
    Array.from({ length }, (_, i) => value[i] || "")
  );
  const [popIndex, setPopIndex] = useState<number>(-1);
  const [shaking, setShaking] = useState(false);

  useEffect(() => {
    setDigits(Array.from({ length }, (_, i) => value[i] || ""));
  }, [value, length]);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    if (error) {
      setShaking(true);
      const t = setTimeout(() => setShaking(false), 400);
      return () => clearTimeout(t);
    }
  }, [error]);

  const triggerPop = useCallback((index: number) => {
    setPopIndex(index);
    setTimeout(() => setPopIndex(-1), 200);
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/\D/g, "").slice(0, length);
      if (raw.length > value.length) {
        triggerPop(raw.length - 1);
      }
      onChange(raw);
      if (inputRef.current) {
        const pos = raw.length;
        inputRef.current.setSelectionRange(pos, pos);
      }
    },
    [onChange, length, value.length, triggerPop]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace" && value.length > 0) {
        onChange(value.slice(0, -1));
      }
    },
    [onChange, value]
  );

  const handleContainerClick = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const isComplete = value.length === length;

  return (
    <div
      className={`flex items-center justify-center gap-2 ${shaking ? "otp-digit-shake" : ""}`}
      onClick={handleContainerClick}
    >
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        maxLength={length}
        disabled={disabled}
        className="absolute w-0 h-0 opacity-0 pointer-events-none"
        aria-label={`Enter ${length}-digit code`}
      />
      {Array.from({ length }, (_, i) => {
        const digit = digits[i] || "";
        const isCurrent = i === value.length && !isComplete;
        const isPopping = i === popIndex;
        const isFilled = i < value.length;

        return (
          <div
            key={i}
            className={`
              w-11 h-14 flex items-center justify-center rounded-xl text-lg font-mono font-semibold
              transition-all duration-150
              ${isPopping ? "otp-digit-pop" : ""}
              ${isFilled ? "otp-digit-glow" : ""}
              ${isCurrent
                ? "neu-concave ring-2 ring-primary/50"
                : isFilled
                  ? "neu-concave"
                  : "neu-concave"
              }
              ${error ? "ring-2 ring-red-400/60" : ""}
              ${disabled ? "opacity-50" : "cursor-text"}
            `}
            style={{ caretColor: "transparent" }}
          >
            {digit && (
              <span
                className={
                  isFilled
                    ? "text-slate-800 dark:text-slate-100"
                    : "text-transparent"
                }
              >
                {digit}
              </span>
            )}
            {isCurrent && !disabled && (
              <span className="w-0.5 h-5 bg-primary animate-pulse" />
            )}
          </div>
        );
      })}
    </div>
  );
}
```

```tsx
// File: src\components\SessionExpiryWarning.tsx
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, TimerReset } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

const WARN_MS = 15 * 60 * 1000;
const CRITICAL_MS = 60 * 1000;
const RESYNC_INTERVAL_MS = 5 * 60 * 1000;

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function SessionExpiryWarning() {
  const { sessionExpiresAt, refreshAuth, logout } = useAuth();
  const navigate = useNavigate();
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const lastResyncRef = useRef(Date.now());
  const expiredRef = useRef(false);

  useEffect(() => {
    if (!sessionExpiresAt) {
      setRemainingMs(null);
      return;
    }
    const expiresAt = new Date(sessionExpiresAt).getTime();
    if (Number.isNaN(expiresAt)) {
      setRemainingMs(null);
      return;
    }

    const tick = () => {
      const left = expiresAt - Date.now();
      setRemainingMs(left);

      // Independent fallback: the server is the authority. If the countdown
      // hits zero (idle window elapsed with no API traffic), re-check; a 401
      // there means the session is truly gone.
      if (left <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        refreshAuth().then((ok) => {
          expiredRef.current = false;
          if (!ok) {
            logout().finally(() => navigate("/vega/admin/login", { replace: true }));
          }
        });
      }

      // Re-sync periodically while active so server-side idle extensions
      // (touch_session) are reflected without a full reload.
      if (Date.now() - lastResyncRef.current >= RESYNC_INTERVAL_MS) {
        lastResyncRef.current = Date.now();
        refreshAuth();
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [sessionExpiresAt, refreshAuth, logout, navigate]);

  if (remainingMs === null || remainingMs > WARN_MS) return null;

  const critical = remainingMs <= CRITICAL_MS;

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium ${
        critical
          ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/50"
          : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50"
      }`}
    >
      {critical ? (
        <TimerReset className="w-4 h-4 shrink-0" />
      ) : (
        <AlertTriangle className="w-4 h-4 shrink-0" />
      )}
      <span>
        {critical ? (
          <>Your session is about to expire. You will be signed out in {formatRemaining(remainingMs)}.</>
        ) : (
          <>
            For security you will be signed out in{" "}
            <span className="tabular-nums font-semibold">{formatRemaining(remainingMs)}</span>.
            Save your work and sign in again to continue.
          </>
        )}
      </span>
    </div>
  );
}
```

```tsx
// File: src\components\ui\alert.tsx
import { type HTMLAttributes, forwardRef } from "react";

interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "destructive";
}

const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ className = "", variant = "default", ...props }, ref) => {
    const variants: Record<string, string> = {
      default: "neu-flat text-foreground border-0",
      destructive:
        "bg-destructive/10 text-destructive border-destructive/20 rounded-xl",
    };
    return (
      <div
        ref={ref}
        role="alert"
        className={`relative w-full rounded-xl p-4 ${variants[variant]} ${className}`}
        {...props}
      />
    );
  }
);
Alert.displayName = "Alert";

const AlertDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className = "", ...props }, ref) => (
    <p ref={ref} className={`text-sm [&_p]:leading-relaxed ${className}`} {...props} />
  )
);
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertDescription };
```

```tsx
// File: src\components\ui\button.tsx
import { type ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "ghost";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "default", disabled, ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center rounded-xl text-sm font-medium transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none h-10 px-4 py-2 cursor-pointer";
    const variants: Record<string, string> = {
      default:
        "neu-btn text-primary-foreground font-semibold shadow-none border-0",
      destructive:
        "bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl",
      outline:
        "neu-btn text-foreground border-0",
      ghost:
        "bg-transparent hover:bg-muted/50 text-muted-foreground hover:text-foreground rounded-xl",
    };

    return (
      <button
        ref={ref}
        className={`${base} ${variants[variant]} ${className}`}
        disabled={disabled}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
```

```tsx
// File: src\components\ui\card.tsx
import { type HTMLAttributes, forwardRef } from "react";

const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className = "", ...props }, ref) => (
    <div
      ref={ref}
      className={`neu-flat text-foreground ${className}`}
      {...props}
    />
  )
);
Card.displayName = "Card";

const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className = "", ...props }, ref) => (
    <div ref={ref} className={`flex flex-col space-y-1.5 p-6 ${className}`} {...props} />
  )
);
CardHeader.displayName = "CardHeader";

const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className = "", ...props }, ref) => (
    <h3 ref={ref} className={`text-2xl font-semibold leading-none tracking-tight ${className}`} {...props} />
  )
);
CardTitle.displayName = "CardTitle";

const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className = "", ...props }, ref) => (
    <p ref={ref} className={`text-sm text-muted-foreground ${className}`} {...props} />
  )
);
CardDescription.displayName = "CardDescription";

const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className = "", ...props }, ref) => (
    <div ref={ref} className={`p-6 pt-0 ${className}`} {...props} />
  )
);
CardContent.displayName = "CardContent";

export { Card, CardHeader, CardTitle, CardDescription, CardContent };
```

```tsx
// File: src\components\ui\dialog.tsx
import { type HTMLAttributes, forwardRef, useEffect, useRef } from "react";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

function Dialog({ open, onOpenChange, children }: DialogProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <div ref={ref} className="relative z-50">{children}</div>
    </div>
  );
}

const DialogContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className = "", ...props }, ref) => (
    <div
      ref={ref}
      className={`fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg neu-convex p-6 ${className}`}
      {...props}
    />
  )
);
DialogContent.displayName = "DialogContent";

const DialogHeader = ({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={`flex flex-col space-y-1.5 text-center sm:text-left ${className}`} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className = "", ...props }, ref) => (
    <h2 ref={ref} className={`text-lg font-semibold leading-none tracking-tight ${className}`} {...props} />
  )
);
DialogTitle.displayName = "DialogTitle";

const DialogDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className = "", ...props }, ref) => (
    <p ref={ref} className={`text-sm text-muted-foreground ${className}`} {...props} />
  )
);
DialogDescription.displayName = "DialogDescription";

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription };
```

```tsx
// File: src\components\ui\input.tsx
import { type InputHTMLAttributes, forwardRef } from "react";

const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = "", ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`flex h-10 w-full rounded-xl neu-concave border-0 bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
```

```tsx
// File: src\components\ui\label.tsx
import { type LabelHTMLAttributes, forwardRef } from "react";

const Label = forwardRef<HTMLLabelElement, LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className = "", ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`}
        {...props}
      />
    );
  }
);
Label.displayName = "Label";

export { Label };
```

```tsx
// File: src\components\ui\tabs.tsx
import { createContext, useContext, useState, type ReactNode } from "react";

interface TabsContextType {
  value: string;
  onValueChange: (value: string) => void;
}

const TabsContext = createContext<TabsContextType>({
  value: "",
  onValueChange: () => {},
});

interface TabsProps {
  defaultValue: string;
  children: ReactNode;
  className?: string;
}

function Tabs({ defaultValue, children, className = "" }: TabsProps) {
  const [value, setValue] = useState(defaultValue);
  return (
    <TabsContext.Provider value={{ value, onValueChange: setValue }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

function TabsList({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`inline-flex h-10 items-center justify-center rounded-xl neu-concave p-1 text-muted-foreground ${className}`}
    >
      {children}
    </div>
  );
}

function TabsTrigger({
  value,
  children,
  className = "",
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  const ctx = useContext(TabsContext);
  const isActive = ctx.value === value;
  return (
    <button
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
        isActive
          ? "neu-btn text-foreground font-semibold"
          : "text-muted-foreground hover:text-foreground"
      } ${className}`}
      onClick={() => ctx.onValueChange(value)}
    >
      {children}
    </button>
  );
}

function TabsContent({
  value,
  children,
  className = "",
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  const ctx = useContext(TabsContext);
  if (ctx.value !== value) return null;
  return (
    <div
      className={`mt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${className}`}
    >
      {children}
    </div>
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
```

```typescript
// File: src\config\site.ts
export const site = {
  name: "Vijay Kumar Sharma",
  tagline: "Legal Research, Drafting & Digital Legal Solutions",
  description:
    "Law graduate (LL.B.), legal researcher, and contract drafting professional with experience supporting individuals, businesses, and startups through practical legal documentation, research, and technology-assisted solutions. Based in India.",

  contact: {
    phone: "+91-9599130381",
    phoneDisplay: "+91-9599130381",
    whatsapp: "https://wa.me/919599130381",
    email: "vijaykrsha@hotmail.com",
    emailAlt: "contact@vijaykrsha.online",
    website: "https://vijaykrsha.online",
    location: "Faridabad, Haryana, India",
  },

  api: {
    baseUrl: import.meta.env.VITE_API_URL || "https://api.vijaykrsha.online",
    contactPath: "/vks/api/contact",
  },

  nav: [
    { label: "Home", path: "/" },
    { label: "About", path: "/about" },
    { label: "Freelance", path: "/freelance" },
    { label: "Portfolio", path: "/portfolio" },
    { label: "Apps", path: "/apps" },
    { label: "Contact", path: "/contact" },
  ],

  trustBadges: [
    { label: "Professional Legal Practice", icon: "calendar" },
    { label: "NDA by Default", icon: "shield" },
    { label: "Interdisciplinary Approach", icon: "diamond" },
  ],

  whyHireMe: [
    {
      title: "NDA First",
      description:
        "Every engagement begins with a non-disclosure agreement. Your data, matters, and communications stay strictly confidential.",
      icon: "shield",
    },
    {
      title: "Professional Legal Practice",
      description:
        "Proven track record across legal research, contract management, and data analytics for clients in multiple industries.",
      icon: "calendar",
    },
    {
      title: "Interdisciplinary Approach",
      description:
        "Rare combination of legal knowledge and technical skill — bridging the gap between law and technology.",
      icon: "diamond",
    },
    {
      title: "Attention to Detail",
      description:
        "Meticulous attention to statutory references, contract clauses, and data accuracy. No shortcuts on quality.",
      icon: "magnifier",
    },
    {
      title: "Timely Delivery",
      description:
        "Efficient workflows and legal-tech integration mean faster delivery without compromising thoroughness.",
      icon: "bolt",
    },
  ],

  highlights: [
    {
      title: "Legal Research",
      description:
        "In-depth legal research across Indian statutes, case law, and regulatory frameworks.",
      icon: "scale",
    },
    {
      title: "Data Analysis",
      description:
        "Transforming raw data into actionable insights with Excel, Python, and visualization tools.",
      icon: "chart",
    },
    {
      title: "Legal-Tech Solutions",
      description:
        "Bridging law and technology — workflow automation, document management, and custom tools.",
      icon: "shield",
    },
  ],

  qualifications: [
    {
      degree: "Post Graduate in Political Science",
      institution: "Indira Gandhi National Open University (IGNOU)",
    },
    {
      degree: "Bachelor of Laws (LLB)",
      institution: "Bundelkhand University",
    },
  ],

  expertise: [
    "Constitutional & Administrative Law",
    "Contract Drafting & Review",
    "Legal Research & Analysis",
    "Data Analysis & Dashboards",
    "Legal-Tech Integration",
    "Regulatory Compliance",
  ],

  services: [
    {
      title: "Legal Research",
      description:
        "Comprehensive legal research including case analysis, statutory interpretation, and regulatory compliance reviews.",
      icon: "scale",
      idealFor: [
        "Law firms needing case research support",
        "Startups navigating regulatory requirements",
        "Businesses entering new markets",
      ],
      deliverables: [
        "Research memorandum with cited authorities",
        "Case law analysis and summary",
        "Regulatory compliance report",
      ],
      turnaround: "3-5 business days",
      pricingModel: "Per project",
    },
    {
      title: "Contract Drafting",
      description:
        "Professional contract drafting, review, and negotiation support for businesses and individuals.",
      icon: "document",
      idealFor: [
        "Businesses needing standard contract templates",
        "Startups drafting founding agreements",
        "Parties negotiating complex deals",
      ],
      deliverables: [
        "Custom-drafted agreements",
        "Contract review with redline markup",
        "Negotiation strategy brief",
      ],
      turnaround: "2-4 business days",
      pricingModel: "Per document",
    },
    {
      title: "Data & Excel Dashboards",
      description:
        "Interactive dashboards, data visualization, and spreadsheet automation for smarter decisions.",
      icon: "chart",
      idealFor: [
        "Firms tracking compliance across regions",
        "Businesses needing financial dashboards",
        "Teams automating repetitive reporting",
      ],
      deliverables: [
        "Interactive Excel/Google Sheets dashboard",
        "Automated reporting templates",
        "Data visualization and charts",
      ],
      turnaround: "3-7 business days",
      pricingModel: "Per project",
    },
    {
      title: "Legal-Tech Integration",
      description:
        "Bridging law and technology — workflow automation, document management, and tech solutions for legal practice.",
      icon: "gear",
      idealFor: [
        "Legal departments digitizing workflows",
        "Firms automating document generation",
        "Practices needing custom tools",
      ],
      deliverables: [
        "Workflow automation setup",
        "Custom tool or script development",
        "Integration documentation and training",
      ],
      turnaround: "1-2 weeks",
      pricingModel: "Hourly / Retainer",
    },
  ],

  principles: [
    {
      title: "NDA by Default",
      description:
        "Every engagement begins with a non-disclosure agreement. Your data and matters stay confidential.",
    },
    {
      title: "Data Integrity",
      description:
        "Accurate, verifiable, and well-sourced work. No shortcuts on quality or credibility.",
    },
    {
      title: "Professional Legal Practice",
      description:
        "Proven track record across legal research, contract management, and data analytics projects.",
    },
    {
      title: "Transparent Communication",
      description:
        "Regular updates, clear timelines, and no surprises. You always know the status of your project.",
    },
  ],

  workingStyle: {
    availability: "Monday - Saturday, 9 AM - 5 PM IST",
    responseTime: "Within 24 hours",
    communication: "Email, Phone",
    timezone: "IST (UTC +5:30)",
  },

  beforeContacting: [
    "Have a clear description of your project or problem ready",
    "Know your timeline and any hard deadlines",
    "Budget range or ballpark figure helps us scope faster",
    "If it involves legal work, having relevant documents on hand speeds up the process",
    "For data projects, knowing your data source and format saves time",
  ],

  projects: [
    {
      title: "Multi-State Compliance Dashboard",
      category: "Legal",
      problem:
        "A mid-size firm struggled to track compliance obligations across 8 Indian states, leading to missed filings and penalties.",
      solution:
        "Built a centralized compliance tracking dashboard with automated alerts, state-specific rule engines, and exportable reports.",
      outcome:
        "Reduced missed filings by 90% and cut compliance review time from 3 days to 2 hours per cycle.",
      tags: ["Compliance", "Excel", "Legal Research"],
    },
    {
      title: "Contract Analytics Platform",
      category: "Tech",
      problem:
        "A legal department spent excessive time manually reviewing contracts for risk clauses and non-standard terms.",
      solution:
        "Developed an automated contract review tool using NLP to flag risk clauses, extract key terms, and score contracts.",
      outcome:
        "Reduced clause analysis time by 60% and improved risk detection accuracy to 95%.",
      tags: ["NLP", "Python", "Legal-Tech"],
    },
    {
      title: "Regulatory Impact Assessment",
      category: "Legal",
      problem:
        "A fintech client entering the Indian market needed to understand the regulatory landscape and compliance requirements.",
      solution:
        "Conducted comprehensive regulatory impact assessment covering RBI guidelines, IT Act, and state-level regulations.",
      outcome:
        "Client launched operations within 3 months with full regulatory compliance, avoiding potential penalties.",
      tags: ["Fintech", "Regulation", "Research"],
    },
    {
      title: "Legal Operations Automation",
      category: "Tech",
      problem:
        "A legal department was spending 20+ hours weekly on manual document generation and case tracking.",
      solution:
        "Automated document generation templates, case tracking workflows, and status reporting dashboards.",
      outcome:
        "Saved 20+ hours weekly, reduced document errors by 85%, and improved case turnaround time by 40%.",
      tags: ["Automation", "Workflow", "Productivity"],
    },
  ],

  apps: [
    {
      title: "Vega Share",
      category: "Android",
      icon: "share",
      status: "live" as const,
      description:
        "WiFi-based file transfer app for Android. Share files from your phone to any device on the same network using just a browser — no app installation needed on the receiving end.",
      features: [
        "Transfer files over same WiFi network via any browser",
        "Preview documents, images, video, and audio directly in the browser",
        "Upload files from any device back to your phone via browser URL",
        "No app installation required on the receiving device",
        "HTTPS secure transfers with self-signed certificates",
        "mDNS auto-discovery on local network",
      ],
      techStack: ["Android", "Kotlin", "NanoHTTPD", "BouncyCastle", "React", "Vite"],
      logo: "/vega-share-icon.png",
      screenshots: ["/vega-share-screenshot.png", "/vega-share-feature.png"],
      link: { label: "Download APK", url: "https://github.com/Kvijay199428/VEGA-SHARE/releases/download/v1.0.1/vega-share-1.0.1.apk" },
      tags: ["Android", "WiFi", "File Transfer", "Browser", "HTTPS"],
    },
    {
      title: "Rent App Management",
      category: "Web",
      icon: "building",
      status: "live" as const,
      description:
        "Web app for landlords to manage tenant-landlord rent transactions. Track monthly rent status, view lifetime earnings, and get a clear financial overview at a glance.",
      features: [
        "Track monthly rent payments — paid, unpaid, or partial",
        "Lifetime earnings dashboard for landlords",
        "Tenant management with full payment history",
        "Clean dashboard for quick financial overview",
      ],
      techStack: ["React", "Node.js", "MongoDB", "Tailwind CSS"],
      link: { label: "Visit App", url: "https://rent.vijaykrsha.online" },
      tags: ["Web App", "Rent", "Tenant Management", "Dashboard"],
    },
  ],
} as const;
```

```tsx
// File: src\context\ThemeContext.tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "dark" || stored === "light") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
```

```tsx
// File: src\contexts\AuthContext.tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { ROUTES } from "@/lib/routes";
import { apiFetch } from "@/lib/adminApi";

interface SecondFactorResult {
  status: "second_factor_required";
  challenge_id: string;
  methods: string[];
}

export interface RateLimitDetail {
  detail: string;
  type: "rate_limited" | "account_locked" | "resend_cooldown" | "verify_cooldown" | "ip_blocked";
  retry_after: number;
}

export class RateLimitError extends Error {
  retryAfter: number;
  limitType: RateLimitDetail["type"];
  constructor(msg: string, retryAfter: number, limitType: RateLimitDetail["type"]) {
    super(msg);
    this.retryAfter = retryAfter;
    this.limitType = limitType;
  }
}

export class OtpCooldownError extends RateLimitError {
  constructor(cooldownSeconds: number) {
    super("Please wait before requesting a new code.", cooldownSeconds, "resend_cooldown");
  }
}

interface AdminIdentity {
  id: string;
  username: string;
  display_name: string;
  role: string;
  role_level?: number | null;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  admin: AdminIdentity | null;
  sessionExpiresAt: string | null;
  refreshAuth: () => Promise<boolean>;
  login: (
    username: string,
    password: string,
    rememberMe?: boolean
  ) => Promise<SecondFactorResult>;
  loginOtpSend: (challengeId: string) => Promise<{ cooldown_seconds: number }>;
  loginOtpVerify: (
    challengeId: string,
    code: string
  ) => Promise<{ totpRequired: boolean; challenge_id?: string }>;
  loginTotp: (
    challengeId: string,
    code: string
  ) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [admin, setAdmin] = useState<AdminIdentity | null>(null);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<string | null>(null);

  const refreshAuth = useCallback(async (): Promise<boolean> => {
    try {
      const response = await apiFetch(ROUTES.ADMINAPIAUTHME, {
        credentials: "include",
        redirectOn401: false,
      });
      if (!response.ok) throw new Error("not authenticated");
      const data = await response.json();
      setIsAuthenticated(true);
      setAdmin(data);
      setSessionExpiresAt(data.session?.expires_at ?? null);
      return true;
    } catch {
      setIsAuthenticated(false);
      setAdmin(null);
      setSessionExpiresAt(null);
      return false;
    }
  }, []);

  useEffect(() => {
    refreshAuth().finally(() => setIsLoading(false));
  }, [refreshAuth]);

  const login = useCallback(
    async (
      username: string,
      password: string,
      rememberMe = false
    ): Promise<SecondFactorResult> => {
      const response = await apiFetch(ROUTES.ADMINAPIAUTHLOGIN, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, remember_me: rememberMe }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: "Login failed" }));
        const msg = typeof err.detail === "string" ? err.detail : "Login failed";
        if (response.status === 429 || response.status === 423) {
          const data = err as RateLimitDetail;
          if (data.retry_after) {
            throw new RateLimitError(data.detail || msg, data.retry_after, data.type || "rate_limited");
          }
        }
        throw new Error(msg);
      }

      return await response.json();
    },
    []
  );

  const loginOtpSend = useCallback(
    async (challengeId: string): Promise<{ cooldown_seconds: number }> => {
      const response = await apiFetch(ROUTES.ADMINAPIAUTHLOGINOTPSEND, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge_id: challengeId }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: "Failed to send code" }));
        const msg = typeof err.detail === "string" ? err.detail : "Failed to send code";
        if (response.status === 429) {
          const data = err as RateLimitDetail;
          if (data.retry_after) {
            throw new OtpCooldownError(data.retry_after);
          }
        }
        throw new Error(msg);
      }

      return await response.json();
    },
    []
  );

  const loginOtpVerify = useCallback(
    async (challengeId: string, code: string) => {
      const response = await apiFetch(ROUTES.ADMINAPIAUTHLOGINOTPVERIFY, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge_id: challengeId, code }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: "OTP verification failed" }));
        const msg = typeof err.detail === "string" ? err.detail : "OTP verification failed";
        if (response.status === 429) {
          const data = err as RateLimitDetail;
          if (data.retry_after) {
            throw new RateLimitError(data.detail || msg, data.retry_after, data.type || "verify_cooldown");
          }
        }
        throw new Error(msg);
      }

      const data = await response.json();
      if (data.status === "totp_required") {
        return { totpRequired: true, challenge_id: data.challenge_id };
      }

      await refreshAuth();
      return { totpRequired: false };
    },
    [refreshAuth]
  );

  const loginTotp = useCallback(
    async (challengeId: string, code: string) => {
      const response = await apiFetch(ROUTES.ADMINAPIAUTHLOGINTOTP, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge_id: challengeId, code }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: "TOTP verification failed" }));
        const msg = typeof err.detail === "string" ? err.detail : "TOTP verification failed";
        if (response.status === 429) {
          const data = err as RateLimitDetail;
          if (data.retry_after) {
            throw new RateLimitError(data.detail || msg, data.retry_after, data.type || "verify_cooldown");
          }
        }
        throw new Error(msg);
      }

      await refreshAuth();
    },
    [refreshAuth]
  );

  const logout = useCallback(async () => {
    await apiFetch(ROUTES.ADMINAPIAUTHLOGOUT, {
      method: "POST",
      credentials: "include",
    });
    setIsAuthenticated(false);
    setAdmin(null);
    setSessionExpiresAt(null);
    window.location.replace("/vega/admin/login");
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        admin,
        sessionExpiresAt,
        refreshAuth,
        login,
        loginOtpSend,
        loginOtpVerify,
        loginTotp,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
```

```typescript
// File: src\hooks\useSpriteAnimation.ts
import { useEffect, useRef, useCallback } from "react";

interface SpriteConfig {
  src: string;
  fps: number;
  frames: number;
  frameWidth: number;
  frameHeight: number;
  opacity: number;
  blendMode: GlobalCompositeOperation;
  loop: boolean;
}

async function loadGzippedImage(src: string): Promise<HTMLImageElement> {
  const res = await fetch(src);
  if (!res.ok) throw new Error(`Failed to fetch sprite: ${res.status}`);

  const buffer = await res.arrayBuffer();

  if (typeof DecompressionStream === "undefined") {
    throw new Error("DecompressionStream not supported");
  }

  const ds = new DecompressionStream("gzip");
  const writer = ds.writable.getWriter();
  writer.write(new Uint8Array(buffer));
  writer.close();

  const decompressed = await new Response(ds.readable).arrayBuffer();
  const blob = new Blob([decompressed], { type: "image/png" });
  const url = URL.createObjectURL(blob);

  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load decompressed sprite"));
    };
    img.src = url;
  });
}

export default function useSpriteAnimation(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  config: SpriteConfig
) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const frameRef = useRef(0);
  const lastTimeRef = useRef(0);
  const rafRef = useRef<number>(0);
  const loadedRef = useRef(false);

  const prefersReducedMotion =
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : true;

  const drawFrame = useCallback(
    (ctx: CanvasRenderingContext2D, image: HTMLImageElement, frame: number) => {
      const { frameWidth, frameHeight, opacity, blendMode } = config;

      ctx.clearRect(0, 0, frameWidth, frameHeight);
      ctx.globalAlpha = opacity;
      ctx.globalCompositeOperation = blendMode;

      ctx.drawImage(
        image,
        frame * frameWidth,
        0,
        frameWidth,
        frameHeight,
        0,
        0,
        frameWidth,
        frameHeight
      );
    },
    [config]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { frameWidth, frameHeight, frames, fps, loop } = config;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = frameWidth * dpr;
    canvas.height = frameHeight * dpr;
    ctx.scale(dpr, dpr);

    let cancelled = false;

    const animate = (timestamp: number) => {
      if (cancelled) return;

      if (!loadedRef.current || !imageRef.current) {
        rafRef.current = requestAnimationFrame(animate);
        return;
      }

      const interval = 1000 / fps;

      if (timestamp - lastTimeRef.current >= interval) {
        lastTimeRef.current = timestamp;
        drawFrame(ctx, imageRef.current, frameRef.current);

        if (frameRef.current < frames - 1) {
          frameRef.current++;
        } else if (loop) {
          frameRef.current = 0;
        }
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    const loadAndStart = async () => {
      try {
        imageRef.current = await loadGzippedImage(config.src);
        loadedRef.current = true;

        if (prefersReducedMotion) {
          drawFrame(ctx, imageRef.current, 0);
          return;
        }

        rafRef.current = requestAnimationFrame(animate);
      } catch (e) {
        console.warn("Sprite animation failed:", e);
        canvas.style.display = "none";
      }
    };

    loadAndStart();

    const handleVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(rafRef.current);
      } else if (loadedRef.current && !prefersReducedMotion) {
        lastTimeRef.current = 0;
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [canvasRef, config, drawFrame, prefersReducedMotion]);
}
```

```css
// File: src\index.css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

@theme {
  /* ── Public site palette (unchanged) ── */
  --color-cream-50: #fdfbf7;
  --color-cream-100: #f7f3eb;
  --color-cream-200: #ede7d9;
  --color-cream-300: #ddd4c0;

  --color-night-900: #0f1219;
  --color-night-800: #161b26;
  --color-night-700: #1e2536;
  --color-night-600: #2a3348;

  --color-glow-500: #a78bfa;
  --color-glow-400: #c4b5fd;
  --color-glow-600: #7c5cf0;

  --color-sage-500: #7a9168;
  --color-sage-400: #96ad85;

  --color-mist-500: #6b8299;
  --color-mist-400: #8ba3b8;

  /* ── Neumorphism admin palette ── */
  --color-background: #E8E8E8;
  --color-foreground: #2D3436;
  --color-card: #E8E8E8;
  --color-card-foreground: #2D3436;
  --color-primary: #7C3AED;
  --color-primary-foreground: #FFFFFF;
  --color-secondary: #8B5CF6;
  --color-secondary-foreground: #FFFFFF;
  --color-muted: #F5E0E8;
  --color-muted-foreground: #636E72;
  --color-accent: #059669;
  --color-accent-foreground: #FFFFFF;
  --color-destructive: #DC2626;
  --color-destructive-foreground: #FFFFFF;
  --color-border: #D0D0D0;
  --color-input: #E8E8E8;
  --color-ring: #7C3AED;

  /* ── Neumorphism shadow sources ── */
  --color-neu-light: #FFFFFF;
  --color-neu-dark: #A3A3A3;

  /* ── Dark mode neumorphism ── */
  --color-dark-background: #2D2D2D;
  --color-dark-foreground: #E0E0E0;
  --color-dark-card: #2D2D2D;
  --color-dark-card-foreground: #E0E0E0;
  --color-dark-muted: #3A3A3A;
  --color-dark-muted-foreground: #A0A0A0;
  --color-dark-border: #404040;
  --color-dark-input: #2D2D2D;
  --color-dark-neu-light: #3A3A3A;
  --color-dark-neu-dark: #202020;
}

html {
  scroll-behavior: smooth;
}

body {
  @apply bg-cream-50 text-night-800 dark:bg-night-900 dark:text-cream-100 transition-colors duration-300;
}

/* =========================================================
   ADMIN CONSOLE THEME
   Scopes admin colors separately from the public site.
   ========================================================= */

.admin-theme {
  --admin-background: #e8e8e8;
  --admin-foreground: #2D3436;
  --admin-card: #e8e8e8;
  --admin-card-foreground: #2D3436;
  --admin-muted: #F5E0E8;
  --admin-muted-foreground: #636E72;
  --admin-border: #D0D0D0;
  --admin-input: #e8e8e8;

  color: var(--admin-foreground);
  background: var(--admin-background);
}

.dark .admin-theme {
  --admin-background: #2D2D2D;
  --admin-foreground: #f1f5f9;
  --admin-card: #2D2D2D;
  --admin-card-foreground: #f1f5f9;
  --admin-muted: #3A3A3A;
  --admin-muted-foreground: #cbd5e1;
  --admin-border: #484848;
  --admin-input: #2D2D2D;

  color: var(--admin-foreground);
  background: var(--admin-background);
}

/* Map admin-theme overrides onto Tailwind semantic tokens */
.admin-theme {
  --color-background: #e8e8e8;
  --color-foreground: #2D3436;
  --color-card: #e8e8e8;
  --color-card-foreground: #2D3436;
  --color-muted: #F5E0E8;
  --color-muted-foreground: #636E72;
  --color-border: #D0D0D0;
  --color-input: #e8e8e8;
  --color-neu-light: #FFFFFF;
  --color-neu-dark: #A3A3A3;
}

.dark .admin-theme {
  --color-background: #2D2D2D;
  --color-foreground: #f1f5f9;
  --color-card: #2D2D2D;
  --color-card-foreground: #f1f5f9;
  --color-muted: #3A3A3A;
  --color-muted-foreground: #cbd5e1;
  --color-border: #484848;
  --color-input: #2D2D2D;
  --color-neu-light: #3A3A3A;
  --color-neu-dark: #202020;
}

/* Explicit text visibility inside admin scope */
.admin-theme .text-foreground {
  color: var(--color-foreground) !important;
}
.admin-theme .text-card-foreground {
  color: var(--color-card-foreground) !important;
}
.admin-theme .text-muted-foreground {
  color: var(--color-muted-foreground) !important;
}

/* Inputs / selects / textareas inside admin */
.admin-theme input,
.admin-theme textarea,
.admin-theme select {
  color: var(--color-foreground);
}
.admin-theme input::placeholder,
.admin-theme textarea::placeholder {
  color: var(--color-muted-foreground);
  opacity: 0.9;
}
.admin-theme select option {
  color: #2D3436;
  background: #ffffff;
}
.dark .admin-theme select option {
  color: #f1f5f9;
  background: #2D2D2D;
}

/* Disabled controls */
.admin-theme button:disabled,
.admin-theme input:disabled,
.admin-theme select:disabled,
.admin-theme textarea:disabled {
  opacity: 0.55;
}

/* ── Neumorphism Utilities ─────────────────────── */

.neu-flat {
  background: var(--color-background);
  color: var(--color-foreground);
  border-radius: 14px;
  box-shadow:
    -5px -5px 15px var(--color-neu-light),
    5px 5px 15px var(--color-neu-dark);
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}
.dark .neu-flat {
  background: var(--color-dark-background);
  box-shadow:
    -5px -5px 15px var(--color-dark-neu-light),
    5px 5px 15px var(--color-dark-neu-dark);
}

.neu-convex {
  background: linear-gradient(145deg, #f0f0f0, #d4d4d4);
  border-radius: 14px;
  box-shadow:
    -5px -5px 15px var(--color-neu-light),
    5px 5px 15px var(--color-neu-dark);
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}
.dark .neu-convex {
  background: linear-gradient(145deg, #333, #272727);
  box-shadow:
    -5px -5px 15px var(--color-dark-neu-light),
    5px 5px 15px var(--color-dark-neu-dark);
}

.neu-concave {
  background: linear-gradient(145deg, #d4d4d4, #f0f0f0);
  border-radius: 14px;
  box-shadow:
    inset -3px -3px 7px var(--color-neu-light),
    inset 3px 3px 7px var(--color-neu-dark);
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}
.dark .neu-concave {
  background: linear-gradient(145deg, #272727, #333);
  box-shadow:
    inset -3px -3px 7px var(--color-dark-neu-light),
    inset 3px 3px 7px var(--color-dark-neu-dark);
}

.neu-pressed {
  background: var(--color-background);
  border-radius: 14px;
  box-shadow:
    inset -3px -3px 7px var(--color-neu-light),
    inset 3px 3px 7px var(--color-neu-dark);
  transition: box-shadow 0.15s ease;
}
.dark .neu-pressed {
  background: var(--color-dark-background);
  box-shadow:
    inset -3px -3px 7px var(--color-dark-neu-light),
    inset 3px 3px 7px var(--color-dark-neu-dark);
}

.neu-btn {
  background: linear-gradient(145deg, #f0f0f0, #d4d4d4);
  border-radius: 12px;
  box-shadow:
    -4px -4px 10px var(--color-neu-light),
    4px 4px 10px var(--color-neu-dark);
  transition: all 0.15s ease;
  cursor: pointer;
  user-select: none;
}
.neu-btn:hover {
  box-shadow:
    -6px -6px 14px var(--color-neu-light),
    6px 6px 14px var(--color-neu-dark);
}
.neu-btn:active {
  background: linear-gradient(145deg, #d4d4d4, #f0f0f0);
  box-shadow:
    inset -3px -3px 7px var(--color-neu-light),
    inset 3px 3px 7px var(--color-neu-dark);
}
.dark .neu-btn {
  background: linear-gradient(145deg, #333, #272727);
  box-shadow:
    -4px -4px 10px var(--color-dark-neu-light),
    4px 4px 10px var(--color-dark-neu-dark);
}
.dark .neu-btn:hover {
  box-shadow:
    -6px -6px 14px var(--color-dark-neu-light),
    6px 6px 14px var(--color-dark-neu-dark);
}
.dark .neu-btn:active {
  background: linear-gradient(145deg, #272727, #333);
  box-shadow:
    inset -3px -3px 7px var(--color-dark-neu-light),
    inset 3px 3px 7px var(--color-dark-neu-dark);
}

/* ── Typing Animation ─────────────────────────────── */

@keyframes typing-loop {
  0% { width: 0 }
  35% { width: 100% }
  60% { width: 100% }
  95% { width: 0 }
  100% { width: 0 }
}

@keyframes typing-glow {
  0% { text-shadow: 0 0 0 transparent; }
  15% { text-shadow: 0 0 8px rgba(124, 92, 240, 0.4); }
  35% { text-shadow: 0 0 12px rgba(124, 92, 240, 0.3); }
  60% { text-shadow: 0 0 8px rgba(124, 92, 240, 0.2); }
  95% { text-shadow: 0 0 0 transparent; }
  100% { text-shadow: 0 0 0 transparent; }
}

.typing-text {
  display: inline-block;
  overflow: hidden;
  white-space: nowrap;
  animation: typing-loop 4s ease-in-out infinite, typing-glow 4s ease-in-out infinite;
}

/* ── Card & Button Interactions (Public) ──────────── */

.card-hover {
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}
.card-hover:hover {
  box-shadow: 0 8px 30px rgba(124, 92, 240, 0.12);
  transform: translateY(-2px);
}

.btn-primary {
  transition: all 0.2s ease-out;
}
.btn-primary:hover {
  box-shadow: 0 4px 20px rgba(124, 92, 240, 0.35);
  transform: translateY(-1px);
}
.btn-primary:active {
  transform: scale(0.98);
  box-shadow: 0 2px 8px rgba(124, 92, 240, 0.25);
}

.btn-outline {
  transition: all 0.2s ease-out;
}
.btn-outline:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}
.btn-outline:active {
  transform: scale(0.98);
}

.nav-link {
  transition: background-color 150ms ease-out, color 150ms ease-out, transform 100ms ease-out;
}
.nav-link:hover {
  transform: scale(1.05);
}
.nav-link:active {
  transform: scale(0.95);
}

/* ── Scroll Reveal ────────────────────────────────── */

.reveal {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.6s ease, transform 0.6s ease;
}
.reveal.visible {
  opacity: 1;
  transform: translateY(0);
}

/* ── Back to Top ──────────────────────────────────── */

.back-to-top {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s ease, transform 0.3s ease;
  transform: translateY(8px);
}
.back-to-top.show {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

/* ── Animated Logo ────────────────────────────────── */

.animated-logo {
  image-rendering: auto;
}

/* ── Status Badges ────────────────────────────────── */

.status-live {
  @apply bg-sage-500 text-white;
}
.status-beta {
  @apply bg-amber-500 text-white;
}
.status-coming-soon {
  @apply bg-cream-300 text-night-800 dark:bg-night-600 dark:text-cream-100;
}

/* ── Checklist ────────────────────────────────────── */

.checklist-item {
  @apply flex items-start gap-3 text-sm text-night-800/70 dark:text-cream-100/70;
}
.checklist-icon {
  @apply mt-0.5 h-4 w-4 text-glow-500 shrink-0;
}

/* ── Footer ───────────────────────────────────────── */

.footer-heading {
  @apply text-xs font-semibold uppercase tracking-wider text-night-800/50 dark:text-cream-100/50 mb-3;
}

/* ── Admin Scrollbar (Neumorphism) ──────────────── */

.admin-theme ::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
.admin-theme ::-webkit-scrollbar-track {
  background: var(--color-background);
  border-radius: 4px;
}
.admin-theme ::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 4px;
  border: 2px solid var(--color-background);
}
.admin-theme ::-webkit-scrollbar-thumb:hover {
  background: var(--color-muted-foreground);
}
.admin-theme * {
  scrollbar-width: thin;
  scrollbar-color: var(--color-border) var(--color-background);
}

/* ── OTP Digit Box Animations ──────────────────── */

@keyframes otp-pop {
  0% { transform: scale(1); }
  50% { transform: scale(1.15); }
  100% { transform: scale(1); }
}

@keyframes otp-shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-6px); }
  40% { transform: translateX(6px); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(4px); }
}

@keyframes otp-glow {
  0% { box-shadow: inset -3px -3px 7px var(--color-neu-light), inset 3px 3px 7px var(--color-neu-dark); }
  50% { box-shadow: inset -3px -3px 7px var(--color-neu-light), inset 3px 3px 7px var(--color-neu-dark), 0 0 12px rgba(5, 150, 105, 0.4); }
  100% { box-shadow: inset -3px -3px 7px var(--color-neu-light), inset 3px 3px 7px var(--color-neu-dark); }
}

.otp-digit-pop {
  animation: otp-pop 0.2s ease-out;
}

.otp-digit-shake {
  animation: otp-shake 0.4s ease-out;
}

.otp-digit-glow {
  animation: otp-glow 0.6s ease-out;
}

/* ── Login Step Transitions ────────────────────── */

.login-step-enter {
  opacity: 0;
  transform: translateX(20px);
}
.login-step-active {
  opacity: 1;
  transform: translateX(0);
  transition: opacity 0.25s ease-out, transform 0.25s ease-out;
}
.login-step-exit {
  opacity: 0;
  transform: translateX(-20px);
  transition: opacity 0.15s ease-in, transform 0.15s ease-in;
}

/* ── Accessibility ────────────────────────────────── */

@media (prefers-reduced-motion: reduce) {
  .typing-text {
    animation: none;
    width: 100%;
    border-right: none;
  }
  .reveal {
    opacity: 1;
    transform: none;
    transition: none;
  }
  .card-hover:hover,
  .btn-primary:hover,
  .btn-outline:hover,
  .nav-link:hover,
  .neu-btn:hover {
    transform: none;
    box-shadow: inherit;
  }
  .btn-primary:active,
  .btn-outline:active,
  .nav-link:active,
  .neu-btn:active {
    transform: none;
  }
  .back-to-top {
    opacity: 1;
    pointer-events: auto;
    transform: none;
  }
  .animated-logo canvas {
    display: none;
  }
  .otp-digit-pop,
  .otp-digit-shake,
  .otp-digit-glow {
    animation: none;
  }
  .login-step-enter,
  .login-step-active,
  .login-step-exit {
    opacity: 1;
    transform: none;
    transition: none;
  }
}
```

```typescript
// File: src\lib\adminApi.ts
import { ROUTES } from "@/lib/routes";

export interface ApiFetchOptions extends RequestInit {
  /** Set false for auth-probing calls where 401 must not redirect. */
  redirectOn401?: boolean;
}

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function readCsrfToken(): string | null {
  const value = /(?:^|;\s*)vks_csrf=([^;]*)/.exec(document.cookie)?.[1];
  return value ? decodeURIComponent(value) : null;
}

function buildHeaders(init: RequestInit): Headers {
  const headers = new Headers(init.headers);
  const method = (init.method ?? "GET").toUpperCase();
  // Backend rejects non-JSON content types on writes, even with empty bodies.
  if (UNSAFE_METHODS.has(method) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (UNSAFE_METHODS.has(method)) {
    const token = readCsrfToken();
    if (token) headers.set("X-CSRF-Token", token);
  }
  return headers;
}

async function doFetch(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    credentials: "include",
    headers: buildHeaders(init),
  });
}

/**
 * Single API client for every admin request: cookies included, CSRF
 * double-submit header attached to state-changing methods, JSON content-type
 * defaulted, and automatic redirect to login on session expiry.
 */
export async function apiFetch(
  url: string,
  options: ApiFetchOptions = {}
): Promise<Response> {
  const { redirectOn401 = true, ...init } = options;

  let response = await doFetch(url, init);

  // CSRF cookie missing (expired or first visit after deploy): the backend
  // issues one on any authenticated GET — grab it via /me and retry once.
  if (
    response.status === 403 &&
    !readCsrfToken() &&
    url !== ROUTES.ADMINAPIAUTHME
  ) {
    await fetch(ROUTES.ADMINAPIAUTHME, { credentials: "include" });
    response = await doFetch(url, init);
  }

  if (response.status === 401 && redirectOn401) {
    window.location.assign("/vega/admin/login");
    throw new Error("SESSION_EXPIRED");
  }

  return response;
}
```

```typescript
// File: src\lib\apiError.ts
interface FastAPIValidationDetail {
  type: string;
  loc: (string | number)[];
  msg: string;
  input?: unknown;
}

export function getApiErrorMessage(data: unknown, fallback = "Something went wrong"): string {
  if (!data || typeof data !== "object") return fallback;

  const detail = (data as Record<string, unknown>).detail;

  if (typeof detail === "string") return detail;

  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as FastAPIValidationDetail;
    if (first && typeof first === "object" && typeof first.msg === "string") {
      const field = first.loc?.filter((s) => typeof s === "string" && s !== "body").join(" ");
      const msg = first.msg.charAt(0).toUpperCase() + first.msg.slice(1);
      return field ? `${field}: ${msg}` : msg;
    }
  }

  if (typeof detail === "object" && detail !== null) {
    const d = detail as Record<string, unknown>;
    if (typeof d.message === "string") return d.message;
    if (typeof d.error === "string") return d.error;
  }

  return fallback;
}
```

```typescript
// File: src\lib\passwordValidation.ts
export interface PasswordRule {
  label: string;
  test: (pw: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  { label: "At least 12 characters", test: (pw) => pw.length >= 12 },
  { label: "Uppercase letter", test: (pw) => /[A-Z]/.test(pw) },
  { label: "Lowercase letter", test: (pw) => /[a-z]/.test(pw) },
  { label: "Number", test: (pw) => /[0-9]/.test(pw) },
  { label: "Special character (!@#$...)", test: (pw) => /[^A-Za-z0-9]/.test(pw) },
  { label: "No whitespace at start/end", test: (pw) => pw === pw.trim() },
];

export function getPasswordErrors(pw: string, username?: string): string[] {
  const errors: string[] = [];
  for (const rule of PASSWORD_RULES) {
    if (!rule.test(pw)) errors.push(rule.label);
  }
  if (username && pw.toLowerCase() === username.toLowerCase()) {
    errors.push("Cannot be the same as username");
  }
  return errors;
}

export function isPasswordValid(pw: string, username?: string): boolean {
  return getPasswordErrors(pw, username).length === 0;
}
```

```typescript
// File: src\lib\routes.ts
const API = "/api";

export const ROUTES = {
  CONTACT: `${API}/vks/api/contact`,

  ADMINAPIAUTHLOGIN: `${API}/admin/api/auth/login`,
  ADMINAPIAUTHLOGINTOTP: `${API}/admin/api/auth/login-totp`,
  ADMINAPIAUTHLOGINOTPSEND: `${API}/admin/api/auth/login-otp-send`,
  ADMINAPIAUTHLOGINOTPVERIFY: `${API}/admin/api/auth/login-otp-verify`,
  ADMINAPIAUTHLOGOUT: `${API}/admin/api/auth/logout`,
  ADMINAPIAUTHME: `${API}/admin/api/auth/me`,
  ADMINAPISETUPREQUIRED: `${API}/admin/api/auth/setup-required`,
  ADMINAPISETUPCREATE: `${API}/admin/api/auth/setup-create`,
  ADMINAPIPASSWORDFORGOTVERIFY: `${API}/admin/api/auth/password/forgot-verify`,
  ADMINAPIPASSWORDFORGOTRESET: `${API}/admin/api/auth/password/forgot-reset`,

  ADMINAPISTATS: `${API}/admin/api/stats`,
  ADMINAPIMESSAGES: `${API}/admin/api/messages`,
  ADMINAPISETTINGS: `${API}/admin/api/settings`,
  ADMINAPIAUDITLOGS: `${API}/admin/api/audit-logs`,
  ADMINAPICHANGEPASSWORD: `${API}/admin/api/settings/change-password`,

  // User management
  ADMINAPIUSERS: `${API}/admin/api/users`,
  ADMINAPIUSERSCREATE: `${API}/admin/api/users/create`,
  ADMINAPIUSERSAVAILABILITY: `${API}/admin/api/users/check-availability`,
  ADMINAPIUSERSBYID: (id: string) => `${API}/admin/api/users/${id}`,
  ADMINAPIUSERDISABLE: (id: string) => `${API}/admin/api/users/${id}/disable`,
  ADMINAPIUSERENABLE: (id: string) => `${API}/admin/api/users/${id}/enable`,
  ADMINAPIUSERREVOKE: (id: string) => `${API}/admin/api/users/${id}/revoke-sessions`,
  ADMINAPIUSERRESETPW: (id: string) => `${API}/admin/api/users/${id}/reset-password`,

  // Per-user TOTP
  ADMINAPIUSERTOTPSETUP: (id: string) => `${API}/admin/api/users/${id}/totp/setup`,
  ADMINAPIUSERTOTPENABLE: (id: string) => `${API}/admin/api/users/${id}/totp/enable`,
  ADMINAPIUSERTOTPDISABLE: (id: string) => `${API}/admin/api/users/${id}/totp/disable`,
  ADMINAPIUSERTOTPRESET: (id: string) => `${API}/admin/api/users/${id}/totp/reset`,

  // Global TOTP (owner's own settings)
  ADMINAPITOTPSETUP: `${API}/admin/api/settings/totp/setup`,
  ADMINAPITOTPENABLE: `${API}/admin/api/settings/totp/enable`,
  ADMINAPITOTPDISABLE: `${API}/admin/api/settings/totp/disable`,

  // Roles & permissions
  ADMINAPIROLES: `${API}/admin/api/roles`,
  ADMINAPIROLESCREATE: `${API}/admin/api/roles`,
  ADMINAPIROLESBYID: (id: string) => `${API}/admin/api/roles/${id}`,
  ADMINAPIPERMISSIONS: `${API}/admin/api/permissions`,
} as const;
```

```tsx
// File: src\main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import App from "@/App";
import "@/index.css";

window.addEventListener("pageshow", (event) => {
  if ((event as PageTransitionEvent).persisted) {
    window.location.reload();
  }
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
```

```tsx
// File: src\pages\About.tsx
import { site } from "@/config/site";

function ScaleIcon() {
  return (
    <svg className="h-6 w-6 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.589-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.589-1.202L5.25 4.971z" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg className="h-6 w-6 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg className="h-6 w-6 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg className="h-6 w-6 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg className="h-5 w-5 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

function DiamondIcon() {
  return (
    <svg className="h-5 w-5 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg className="h-5 w-5 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  );
}

function MagnifierIcon() {
  return (
    <svg className="h-5 w-5 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  );
}

const serviceIconMap: Record<string, React.FC> = {
  scale: ScaleIcon,
  document: DocumentIcon,
  chart: ChartIcon,
  gear: GearIcon,
};

const whyHireIconMap: Record<string, React.FC> = {
  shield: ShieldIcon,
  calendar: () => (
    <svg className="h-5 w-5 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  ),
  diamond: DiamondIcon,
  magnifier: MagnifierIcon,
  bolt: BoltIcon,
};

export default function About() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-20">
      {/* ── Section 1: Who I Am ──────────────────── */}
      <section className="mb-16 reveal">
        <h2 className="text-2xl md:text-3xl font-bold text-night-800 dark:text-cream-50 mb-6">
          Who I Am
        </h2>
        <div className="p-6 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700">
          <div className="flex items-start gap-5">
            <div className="hidden sm:flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-glow-500/10 border border-glow-500/20">
              <span className="text-2xl font-bold text-glow-600 dark:text-glow-400">VK</span>
            </div>
            <div>
              <h3 className="font-semibold text-night-800 dark:text-cream-50 mb-1">
                {site.name}
              </h3>
              <p className="text-sm text-glow-500 font-medium mb-3">
                {site.tagline}
              </p>
              <p className="text-night-800 dark:text-cream-100 leading-relaxed">
                {site.description}
              </p>
              <p className="text-night-800/60 dark:text-cream-100/60 leading-relaxed mt-3 text-sm">
                My legal work includes research, drafting, document review, and legal support
                across various practice areas. During my legal journey, I have worked on matters
                relating to Family Law, Criminal Law, the Negotiable Instruments Act, Contract
                Law, Consumer Law, Constitutional Law, and other civil and commercial legal
                matters. Alongside legal practice, I use technology and data-driven workflows
                to improve accuracy, organization, and efficiency while maintaining complete
                confidentiality for every engagement.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 2: What I Do ─────────────────── */}
      <section className="mb-16">
        <h2 className="text-2xl md:text-3xl font-bold text-night-800 dark:text-cream-50 mb-6">
          What I Do
        </h2>
        <div className="grid sm:grid-cols-2 gap-6">
          {site.services.map((s, i) => {
            const Icon = serviceIconMap[s.icon] ?? ScaleIcon;
            return (
              <div
                key={s.title}
                className="reveal card-hover p-6 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700"
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <Icon />
                <h3 className="mt-3 font-semibold text-night-800 dark:text-cream-50">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm text-night-800/60 dark:text-cream-100/60 leading-relaxed">
                  {s.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Section 3: How I Work ────────────────── */}
      <section className="mb-16">
        <h2 className="text-2xl md:text-3xl font-bold text-night-800 dark:text-cream-50 mb-6">
          How I Work
        </h2>
        <div className="grid sm:grid-cols-2 gap-6">
          {site.principles.map((p, i) => (
            <div
              key={p.title}
              className="reveal card-hover p-6 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700"
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <h3 className="font-semibold text-glow-500 mb-2">{p.title}</h3>
              <p className="text-sm text-night-800/60 dark:text-cream-100/60 leading-relaxed">
                {p.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Section 4: Why Clients Choose to Work With Me ───────────────── */}
      <section className="mb-16">
        <h2 className="text-2xl md:text-3xl font-bold text-night-800 dark:text-cream-50 mb-6">
          Why Clients Choose to Work With Me
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {site.whyHireMe.map((item, i) => {
            const Icon = whyHireIconMap[item.icon] ?? ShieldIcon;
            return (
              <div
                key={item.title}
                className="reveal card-hover p-6 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700"
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <Icon />
                <h3 className="mt-3 font-semibold text-night-800 dark:text-cream-50">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm text-night-800/60 dark:text-cream-100/60 leading-relaxed">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Section 5: Education & Credentials ───── */}
      <section>
        <h2 className="text-2xl md:text-3xl font-bold text-night-800 dark:text-cream-50 mb-6">
          Education & Credentials
        </h2>

        <div className="grid sm:grid-cols-2 gap-6 mb-8">
          {site.qualifications.map((q, i) => (
            <div
              key={q.degree}
              className="reveal card-hover p-6 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700"
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <p className="text-sm text-glow-500 font-medium mb-1">{q.degree}</p>
              <p className="text-night-800/70 dark:text-cream-100/70 text-sm">{q.institution}</p>
            </div>
          ))}
        </div>

        <h3 className="text-lg font-semibold text-night-800 dark:text-cream-50 mb-4">
          Areas of Practice
        </h3>
        <div className="flex flex-wrap gap-3">
          {site.expertise.map((e) => (
            <span
              key={e}
              className="text-sm px-4 py-2 rounded-full bg-glow-500/10 border border-glow-500/20 text-glow-600 dark:text-glow-400 font-medium"
            >
              {e}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
```

```tsx
// File: src\pages\admin\AdminLayout.tsx
import { useState, useEffect } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import AnimatedLogo from "../../components/AnimatedLogo";
import SessionExpiryWarning from "../../components/SessionExpiryWarning";
import {
  LayoutDashboard,
  Inbox,
  Settings,
  Users,
  ShieldCheck,
  ScrollText,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

const navItems = [
  { to: "/vega/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: null },
  { to: "/vega/admin/inbox", label: "Inbox", icon: Inbox, roles: null },
  { to: "/vega/admin/settings", label: "Settings", icon: Settings, roles: null },
  { to: "/vega/admin/users", label: "Users", icon: Users, roles: ["owner", "admin", "manager"] },
  { to: "/vega/admin/roles", label: "Roles", icon: ShieldCheck, roles: ["owner", "admin", "manager"] },
  { to: "/vega/admin/audit-logs", label: "Audit Logs", icon: ScrollText, roles: null },
];

const MOBILE_BREAKPOINT = 768;

export default function AdminLayout() {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem("admin-sidebar-collapsed");
    if (saved !== null) return saved === "true";
    return window.innerWidth < MOBILE_BREAKPOINT;
  });

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handler = (e: MediaQueryListEvent) => {
      setCollapsed(e.matches);
      localStorage.setItem("admin-sidebar-collapsed", String(e.matches));
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  function toggleSidebar() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("admin-sidebar-collapsed", String(next));
      return next;
    });
  }

  function handleLogout() {
    logout();
    navigate("/vega/admin/login");
  }

  return (
    <div className="admin-theme flex h-screen overflow-hidden bg-background text-foreground">
      <aside
        className={`${
          collapsed ? "w-16" : "w-64"
        } neu-flat border-0 flex flex-col transition-all duration-200 shrink-0 m-2 rounded-2xl`}
      >
        {/* Header */}
        <div
          className={`flex items-center border-b border-border/50 min-h-[57px] ${
            collapsed
              ? "flex-col py-3 px-2 gap-2"
              : "flex-row gap-2 px-3 py-4"
          }`}
        >
          <AnimatedLogo size={collapsed ? 32 : 28} />
          {!collapsed && (
            <span className="font-semibold text-sm truncate typing-text text-primary">VIJAYKRSHA.ONLINE</span>
          )}
          {!collapsed && (
            <button
              onClick={toggleSidebar}
              className="ml-auto p-1.5 rounded-xl text-muted-foreground hover:text-foreground transition-colors"
              title="Collapse sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>
        {collapsed && (
          <button
            onClick={toggleSidebar}
            className="mx-auto p-1.5 rounded-xl text-muted-foreground hover:text-foreground transition-colors"
            title="Expand sidebar"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        )}

        {/* Navigation */}
        <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
          {navItems
            .filter((item) => !item.roles || (admin?.role && item.roles.includes(admin.role)))
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 ${
                    isActive
                      ? "neu-pressed text-primary font-semibold"
                      : "text-foreground/75 hover:text-foreground hover:bg-muted/40"
                  } ${collapsed ? "justify-center" : ""}`
                }
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-border/50 px-2 py-3 space-y-2">
          {!collapsed && admin && (
            <div className="px-3 py-2 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-primary">
                  {(admin.display_name || admin.username).charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{admin.display_name || admin.username}</p>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary">
                  {admin.role}
                </span>
              </div>
            </div>
          )}
          {collapsed && admin && (
            <div className="flex justify-center">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-xs font-bold text-primary">
                  {(admin.display_name || admin.username).charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-destructive transition-colors ${
              collapsed ? "justify-center" : ""
            }`}
            title={collapsed ? "Logout" : undefined}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-2">
        <div className="h-full neu-flat rounded-2xl p-6 flex flex-col gap-3">
          <SessionExpiryWarning />
          <Outlet />
        </div>
      </main>
    </div>
  );
}
```

```tsx
// File: src\pages\admin\AuditLogs.tsx
import { useEffect, useState } from "react";
import { ROUTES } from "@/lib/routes";
import { apiFetch } from "@/lib/adminApi";

interface AuditLog {
  id: number;
  event: string;
  actor_admin_id: string;
  ip_address: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch(`${ROUTES.ADMINAPIAUDITLOGS}?page=${page}&limit=50`)
      .then((r) => r.json())
      .then((data) => {
        setLogs(data.items ?? []);
        setTotal(data.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Audit Logs</h1>
        <p className="text-muted-foreground text-sm">{total} total entries</p>
      </div>

      <div className="neu-flat overflow-hidden text-foreground">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
        ) : (
          <table className="w-full">
            <thead className="border-b border-border/50 bg-muted/30">
              <tr>
                <th className="text-left p-4 text-sm font-semibold text-foreground">Event</th>
                <th className="text-left p-4 text-sm font-semibold text-foreground">Actor</th>
                <th className="text-left p-4 text-sm font-semibold text-foreground">IP</th>
                <th className="text-left p-4 text-sm font-semibold text-foreground">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                  <td className="p-4 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      log.event.includes("success") || log.event.includes("verified") ? "bg-green-100 text-green-700" :
                      log.event.includes("failure") || log.event.includes("disabled") ? "bg-red-100 text-red-700" :
                      "bg-slate-100 text-slate-700"
                    }`}>
                      {log.event}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-muted-foreground font-mono text-xs">
                    {log.actor_admin_id?.slice(0, 8) ?? "—"}
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">{log.ip_address ?? "—"}</td>
                  <td className="p-4 text-sm text-muted-foreground">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 neu-btn text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 neu-btn text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
```

```tsx
// File: src\pages\admin\Dashboard.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ROUTES } from "@/lib/routes";
import { apiFetch } from "@/lib/adminApi";
import { MessageSquare, Mail, Clock, CheckCircle, ArrowRight } from "lucide-react";

interface Stats {
  total_messages: number;
  new_messages: number;
  in_progress: number;
  resolved: number;
}

interface Message {
  id: string;
  reference: string;
  sender_name: string;
  sender_email: string;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<Message[]>([]);

  useEffect(() => {
    apiFetch(ROUTES.ADMINAPISTATS)
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
    apiFetch(`${ROUTES.ADMINAPIMESSAGES}?limit=5`)
      .then((r) => r.json())
      .then((data) => setRecent(data.items ?? []))
      .catch(() => {});
  }, []);

  const cards = [
    { label: "Total Messages", value: stats?.total_messages ?? 0, icon: MessageSquare, color: "text-primary" },
    { label: "New", value: stats?.new_messages ?? 0, icon: Mail, color: "text-orange-500" },
    { label: "In Progress", value: stats?.in_progress ?? 0, icon: Clock, color: "text-yellow-500" },
    { label: "Resolved", value: stats?.resolved ?? 0, icon: CheckCircle, color: "text-accent" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Overview of your admin console</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="neu-convex p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-muted-foreground">{card.label}</span>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </div>
            <p className="text-3xl font-bold">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="neu-flat">
        <div className="flex items-center justify-between p-6 border-b border-border/50">
          <h2 className="font-semibold">Recent Messages</h2>
          <Link to="/vega/admin/inbox" className="text-sm text-primary hover:underline flex items-center gap-1">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="divide-y divide-border/50">
          {recent.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No messages yet.</p>
          ) : (
            recent.map((msg) => (
              <Link
                key={msg.id}
                to={`/vega/admin/messages/${msg.id}`}
                className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{msg.sender_name || "Anonymous"}</p>
                  <p className="text-xs text-muted-foreground truncate">{msg.subject}</p>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    msg.status === "new" ? "bg-orange-100 text-orange-700" :
                    msg.status === "in_progress" ? "bg-yellow-100 text-yellow-700" :
                    "bg-green-100 text-green-700"
                  }`}>
                    {msg.status}
                  </span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(msg.created_at).toLocaleDateString()}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
```

```tsx
// File: src\pages\admin\Inbox.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ROUTES } from "@/lib/routes";
import { apiFetch } from "@/lib/adminApi";
import { Search } from "lucide-react";

interface Message {
  id: string;
  reference: string;
  sender_name: string;
  sender_email: string;
  subject: string;
  status: string;
  priority: string;
  channel: string;
  created_at: string;
}

export default function Inbox() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    apiFetch(`${ROUTES.ADMINAPIMESSAGES}?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setMessages(data.items ?? []);
        setTotal(data.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, search, statusFilter]);

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Inbox</h1>
        <p className="text-muted-foreground text-sm">{total} total messages</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            placeholder="Search messages..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2 neu-concave rounded-xl bg-transparent text-foreground text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-4 py-2 neu-concave rounded-xl bg-transparent text-foreground text-sm"
        >
          <option value="">All Statuses</option>
          <option value="new">New</option>
          <option value="in_progress">In Progress</option>
          <option value="waiting">Waiting</option>
          <option value="resolved">Resolved</option>
          <option value="spam">Spam</option>
        </select>
      </div>

      <div className="neu-flat overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
        ) : messages.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No messages found.</div>
        ) : (
          <div className="divide-y divide-border/50">
            {messages.map((msg) => (
              <Link
                key={msg.id}
                to={`/vega/admin/messages/${msg.id}`}
                className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{msg.sender_name || "Anonymous"}</p>
                    <span className="text-xs text-muted-foreground">({msg.sender_email})</span>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{msg.subject}</p>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    msg.status === "new" ? "bg-orange-100 text-orange-700" :
                    msg.status === "in_progress" ? "bg-yellow-100 text-yellow-700" :
                    msg.status === "resolved" ? "bg-green-100 text-green-700" :
                    "bg-slate-100 text-slate-700"
                  }`}>
                    {msg.status.replace("_", " ")}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    msg.priority === "urgent" ? "bg-red-100 text-red-700" :
                    msg.priority === "high" ? "bg-orange-100 text-orange-700" :
                    "bg-slate-100 text-slate-600"
                  }`}>
                    {msg.priority}
                  </span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(msg.created_at).toLocaleDateString()}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 neu-btn text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 neu-btn text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
```

```tsx
// File: src\pages\admin\MessageDetail.tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ROUTES } from "@/lib/routes";
import { apiFetch } from "@/lib/adminApi";
import { ArrowLeft, Send, Tag, MessageSquare } from "lucide-react";

interface Note {
  id: string;
  body: string;
  author_id: string;
  created_at: string;
}

interface Tag_ {
  id: string;
  name: string;
  color: string;
}

interface Message {
  id: string;
  reference: string;
  sender_name: string;
  sender_email: string;
  sender_phone: string;
  subject: string;
  body: string;
  status: string;
  priority: string;
  channel: string;
  source_page: string;
  created_at: string;
  notes: Note[];
  tags: Tag_[];
}

export default function MessageDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [message, setMessage] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);
  const [noteBody, setNoteBody] = useState("");
  const [newTag, setNewTag] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");

  useEffect(() => {
    if (!id) return;
    apiFetch(`${ROUTES.ADMINAPIMESSAGES}/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setMessage(data);
        setStatus(data.status);
        setPriority(data.priority);
      })
      .catch(() => navigate("/vega/admin/inbox"))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  async function updateField(field: string, value: string) {
    if (!id) return;
    await apiFetch(`${ROUTES.ADMINAPIMESSAGES}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    setMessage((prev) => prev ? { ...prev, [field]: value } : prev);
  }

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !noteBody.trim()) return;
    const res = await apiFetch(`${ROUTES.ADMINAPIMESSAGES}/${id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: noteBody }),
    });
    const note = await res.json();
    setMessage((prev) => prev ? { ...prev, notes: [...prev.notes, note] } : prev);
    setNoteBody("");
  }

  async function addTag(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !newTag.trim()) return;
    await apiFetch(`${ROUTES.ADMINAPIMESSAGES}/${id}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tag_name: newTag }),
    });
    setNewTag("");
    const refreshed = await apiFetch(`${ROUTES.ADMINAPIMESSAGES}/${id}`).then((r) => r.json());
    setMessage(refreshed);
  }

  if (loading) return <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>;
  if (!message) return null;

  return (
    <div className="space-y-6 max-w-4xl">
      <button onClick={() => navigate("/vega/admin/inbox")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to inbox
      </button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{message.subject}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {message.sender_name} ({message.sender_email}) — {message.reference}
          </p>
        </div>
        <div className="flex gap-2">
          <select value={status} onChange={(e) => { setStatus(e.target.value); updateField("status", e.target.value); }} className="px-3 py-1 neu-concave rounded-xl bg-transparent text-foreground text-sm">
            <option value="new">New</option>
            <option value="in_progress">In Progress</option>
            <option value="waiting">Waiting</option>
            <option value="resolved">Resolved</option>
            <option value="spam">Spam</option>
          </select>
          <select value={priority} onChange={(e) => { setPriority(e.target.value); updateField("priority", e.target.value); }} className="px-3 py-1 neu-concave rounded-xl bg-transparent text-foreground text-sm">
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
      </div>

      <div className="neu-flat rounded-xl p-6">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{message.body}</p>
        <div className="mt-4 pt-4 border-t border-border/50 flex gap-4 text-xs text-muted-foreground">
          <span>Channel: {message.channel}</span>
          <span>Received: {new Date(message.created_at).toLocaleString()}</span>
          {message.sender_phone && <span>Phone: {message.sender_phone}</span>}
        </div>
      </div>

      <div className="neu-flat rounded-xl p-6">
        <h2 className="font-semibold mb-4 flex items-center gap-2"><Tag className="h-4 w-4" /> Tags</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          {message.tags.length === 0 && <span className="text-xs text-muted-foreground">No tags</span>}
          {message.tags.map((t) => (
            <span key={t.id} className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">{t.name}</span>
          ))}
        </div>
        <form onSubmit={addTag} className="flex gap-2">
          <input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="Add tag..." className="flex-1 px-3 py-1 neu-concave rounded-xl bg-transparent text-foreground text-sm" />
          <button type="submit" className="px-3 py-1 neu-btn text-primary-foreground text-sm">Add</button>
        </form>
      </div>

      <div className="neu-flat rounded-xl p-6">
        <h2 className="font-semibold mb-4 flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Notes</h2>
        <div className="space-y-3 mb-4">
          {message.notes.length === 0 && <p className="text-xs text-muted-foreground">No notes yet</p>}
          {message.notes.map((n) => (
            <div key={n.id} className="p-3 neu-concave rounded-xl">
              <p className="text-sm">{n.body}</p>
              <p className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</p>
            </div>
          ))}
        </div>
        <form onSubmit={addNote} className="flex gap-2">
          <input value={noteBody} onChange={(e) => setNoteBody(e.target.value)} placeholder="Add a note..." className="flex-1 px-3 py-1 neu-concave rounded-xl bg-transparent text-foreground text-sm" />
          <button type="submit" className="px-3 py-1 neu-btn text-primary-foreground text-sm flex items-center gap-1">
            <Send className="h-3 w-3" /> Add
          </button>
        </form>
      </div>
    </div>
  );
}
```

```tsx
// File: src\pages\admin\Roles.tsx
import { useState, useEffect } from "react";
import { ROUTES } from "../../lib/routes";
import { apiFetch } from "@/lib/adminApi";
import { getApiErrorMessage } from "@/lib/apiError";
import { useAuth } from "../../contexts/AuthContext";
import {
  Shield,
  ShieldCheck,
  Plus,
  Trash2,
  X,
} from "lucide-react";

interface RoleItem {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  level: number;
  user_count: number;
  permissions: string[];
}

interface PermissionItem {
  id: string;
  key: string;
  description: string | null;
  category: string | null;
}

const RANK_PRESETS = [
  { level: 80, label: "Admin-level (80)" },
  { level: 60, label: "Manager-level (60)" },
  { level: 40, label: "Support-level (40)" },
  { level: 20, label: "Viewer-level (20)" },
];

function capitalizeRole(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export default function RolesPage() {
  const { admin: currentAdmin } = useAuth();
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const canManageRoles = ["owner", "admin", "manager"].includes(currentAdmin?.role || "");
  const myLevel = currentAdmin?.role_level ?? null;

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const [rolesRes, permsRes] = await Promise.all([
        apiFetch(ROUTES.ADMINAPIROLES),
        apiFetch(ROUTES.ADMINAPIPERMISSIONS),
      ]);
      if (rolesRes.ok) {
        const data = await rolesRes.json();
        setRoles(data.items || []);
      }
      if (permsRes.ok) {
        const data = await permsRes.json();
        setPermissions(data.items || []);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(role: RoleItem) {
    setDeleteError("");
    try {
      const res = await apiFetch(ROUTES.ADMINAPIROLESBYID(role.id), { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const detail = getApiErrorMessage(data, "Failed to delete role");
        const messages: Record<string, string> = {
          role_in_use: `Cannot delete "${capitalizeRole(role.name)}" — one or more users still have this role.`,
          system_role_protected: "System roles cannot be deleted.",
          permission_denied: "You do not have permission to delete roles.",
        };
        setDeleteError(messages[detail] || detail);
        return;
      }
      load();
    } catch {
      setDeleteError("Network error while deleting role.");
    }
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="w-6 h-6" />
            Roles &amp; Permissions
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Custom roles inherit nothing — pick exactly what they can do.
          </p>
        </div>
        {canManageRoles && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 neu-btn text-primary-foreground text-sm font-semibold"
          >
            <Plus className="w-4 h-4" />
            Create Role
          </button>
        )}
      </div>

      {deleteError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 mb-4 px-4 py-3 rounded-xl text-sm bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/50"
        >
          <span>{deleteError}</span>
          <button onClick={() => setDeleteError("")} aria-label="Dismiss" className="shrink-0 hover:opacity-70 transition-opacity">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="neu-flat overflow-hidden text-foreground">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/30 border-b border-border/50">
              <th className="text-left px-4 py-3 text-sm font-semibold">Role</th>
              <th className="text-left px-4 py-3 text-sm font-semibold">Type</th>
              <th className="text-left px-4 py-3 text-sm font-semibold">Rank</th>
              <th className="text-left px-4 py-3 text-sm font-semibold">Users</th>
              <th className="text-left px-4 py-3 text-sm font-semibold">Permissions</th>
              {canManageRoles && <th className="w-10"></th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={canManageRoles ? 6 : 5} className="text-center py-8 text-muted-foreground">Loading...</td>
              </tr>
            ) : roles.length === 0 ? (
              <tr>
                <td colSpan={canManageRoles ? 6 : 5} className="text-center py-8 text-muted-foreground">No roles found</td>
              </tr>
            ) : (
              roles.map((role) => (
                <tr key={role.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-primary" />
                      <span className="font-medium text-sm">{capitalizeRole(role.name)}</span>
                    </div>
                    {role.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 ml-6">{role.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      role.is_system
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                        : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                    }`}>
                      {role.is_system ? "System" : "Custom"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">{role.level}</td>
                  <td className="px-4 py-3 text-sm">{role.user_count}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{role.permissions.length}</td>
                  {canManageRoles && (
                    <td className="px-4 py-3">
                      {!role.is_system && role.user_count === 0 && (
                        <button
                          onClick={() => handleDelete(role)}
                          title={`Delete ${capitalizeRole(role.name)}`}
                          className="p-1.5 rounded-xl text-red-600 dark:text-red-400 hover:bg-muted/50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <CreateRoleDialog
          myLevel={myLevel}
          permissions={permissions}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}
    </div>
  );
}

function CreateRoleDialog({ myLevel, permissions, onClose, onCreated }: {
  myLevel: number | null;
  permissions: PermissionItem[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const maxLevel = myLevel != null ? myLevel - 1 : 99;
  const availablePresets = RANK_PRESETS.filter((p) => p.level <= maxLevel);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rankMode, setRankMode] = useState<"preset" | "custom">(availablePresets.length > 0 ? "preset" : "custom");
  const [presetLevel, setPresetLevel] = useState<number>(availablePresets[0]?.level ?? Math.min(40, maxLevel));
  const [customLevel, setCustomLevel] = useState<string>(String(Math.max(1, Math.min(30, maxLevel))));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const effectiveLevel =
    rankMode === "preset" ? presetLevel : Math.max(1, Math.min(maxLevel, parseInt(customLevel, 10) || 1));

  const grouped = permissions.reduce<Record<string, PermissionItem[]>>((acc, p) => {
    const cat = p.category || "other";
    (acc[cat] = acc[cat] || []).push(p);
    return acc;
  }, {});

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await apiFetch(ROUTES.ADMINAPIROLESCREATE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim().toLowerCase(),
          description: description.trim() || undefined,
          level: effectiveLevel,
          permissions: Array.from(selected),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(getApiErrorMessage(data, "Failed to create role"));
        return;
      }
      onCreated();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog onClose={onClose}>
      <h2 className="text-lg font-semibold mb-4">Create Custom Role</h2>
      {error && <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl text-sm">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Role Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. content-editor, temp-support"
            maxLength={64}
            className="w-full px-3 py-2 neu-concave rounded-xl bg-transparent text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <p className="mt-1 text-xs text-muted-foreground">Lowercase letters, numbers, dashes and underscores.</p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this role for?"
            maxLength={200}
            className="w-full px-3 py-2 neu-concave rounded-xl bg-transparent text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Rank *</label>
          <div className="flex gap-2">
            {availablePresets.length > 0 && (
              <select
                value={rankMode === "preset" ? String(presetLevel) : "custom"}
                onChange={(e) => {
                  if (e.target.value === "custom") setRankMode("custom");
                  else { setRankMode("preset"); setPresetLevel(parseInt(e.target.value, 10)); }
                }}
                className="flex-1 px-3 py-2 neu-concave rounded-xl bg-transparent text-sm"
              >
                {availablePresets.map((p) => (
                  <option key={p.level} value={p.level}>{p.label}</option>
                ))}
                <option value="custom">Custom…</option>
              </select>
            )}
            {(rankMode === "custom" || availablePresets.length === 0) && (
              <input
                type="number"
                min={1}
                max={maxLevel}
                value={customLevel}
                onChange={(e) => setCustomLevel(e.target.value)}
                className="w-24 px-3 py-2 neu-concave rounded-xl bg-transparent text-sm"
              />
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Higher rank outranks lower. Max for you: {maxLevel}.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Permissions ({selected.size})</label>
          <div className="neu-concave rounded-xl p-3 max-h-56 overflow-y-auto space-y-3">
            {Object.entries(grouped).map(([category, perms]) => (
              <div key={category}>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">{category}</p>
                <div className="space-y-1">
                  {perms.map((p) => (
                    <label key={p.id} className="flex items-start gap-2 text-sm cursor-pointer hover:bg-muted/30 rounded-lg p-1 transition-colors">
                      <input
                        type="checkbox"
                        checked={selected.has(p.key)}
                        onChange={() => toggle(p.key)}
                        className="mt-0.5 accent-current"
                      />
                      <span>
                        <span className="font-mono text-xs">{p.key}</span>
                        {p.description && (
                          <span className="block text-xs text-muted-foreground">{p.description}</span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm neu-btn text-foreground">Cancel</button>
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="px-4 py-2 text-sm neu-btn text-primary-foreground font-semibold disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Role"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function Dialog({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative neu-convex w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-muted/50 transition-colors">
          <X className="w-4 h-4" />
        </button>
        {children}
      </div>
    </div>
  );
}
```

```tsx
// File: src\pages\admin\Settings.tsx
import { useEffect, useState } from "react";
import { ROUTES } from "@/lib/routes";
import { apiFetch } from "@/lib/adminApi";
import { getPasswordErrors } from "@/lib/passwordValidation";
import { Shield, Lock } from "lucide-react";

export default function Settings() {
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [totpSecret, setTotpSecret] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    apiFetch(ROUTES.ADMINAPISETTINGS)
      .then((r) => r.json())
      .then((data) => setTotpEnabled(data.totp_enabled))
      .catch(() => {});
  }, []);

  async function startTotpSetup() {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(ROUTES.ADMINAPITOTPSETUP);
      const data = await res.json();
      setTotpSecret(data.secret);
      setShowSetup(true);
    } catch {
      setError("Failed to load TOTP setup");
    } finally {
      setLoading(false);
    }
  }

  async function enableTotp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(ROUTES.ADMINAPITOTPENABLE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: totpCode }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Failed" }));
        throw new Error(typeof err.detail === "string" ? err.detail : "Failed");
      }
      setTotpEnabled(true);
      setShowSetup(false);
      setMsg("TOTP enabled successfully");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function disableTotp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(ROUTES.ADMINAPITOTPDISABLE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ totp_code: totpCode }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Failed" }));
        throw new Error(typeof err.detail === "string" ? err.detail : "Failed");
      }
      setTotpEnabled(false);
      setShowSetup(false);
      setMsg("TOTP disabled successfully");
      setTotpCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    const pwErrors = getPasswordErrors(newPassword);
    if (pwErrors.length > 0) {
      setError(`Password requirements not met: ${pwErrors.join(", ")}`);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(ROUTES.ADMINAPICHANGEPASSWORD, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Failed" }));
        throw new Error(typeof err.detail === "string" ? err.detail : "Failed");
      }
      setMsg("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm">Manage your security settings</p>
      </div>

      {msg && <div className="p-3 bg-green-50 border border-green-200 text-green-800 rounded-xl text-sm">{msg}</div>}
      {error && <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-sm">{error}</div>}

      <div className="neu-flat p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 neu-btn rounded-xl">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <h2 className="font-semibold">Two-Factor Authentication</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {totpEnabled ? "TOTP is currently enabled" : "TOTP is currently disabled"}
        </p>
        {!showSetup ? (
          totpEnabled ? (
            <div className="space-y-3">
              <p className="text-sm">Enter your TOTP code to disable:</p>
              <form onSubmit={disableTotp} className="flex gap-2">
                <input
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  className="px-3 py-1 neu-concave rounded-xl text-foreground text-sm font-mono w-32 bg-transparent"
                  maxLength={6}
                />
                <button type="submit" disabled={loading} className="px-4 py-1 neu-btn text-destructive-foreground text-sm bg-destructive">
                  Disable
                </button>
              </form>
            </div>
          ) : (
            <button onClick={startTotpSetup} disabled={loading} className="px-4 py-2 neu-btn text-primary-foreground text-sm font-semibold">
              Enable TOTP
            </button>
          )
        ) : (
          <div className="space-y-4">
            <div className="neu-concave p-4 rounded-xl">
              <p className="text-xs text-muted-foreground mb-2">Add this secret to your authenticator app:</p>
              <code className="text-sm font-mono break-all">{totpSecret}</code>
            </div>
            <form onSubmit={enableTotp} className="flex gap-2">
              <input
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="px-3 py-1 neu-concave rounded-xl text-sm font-mono w-32 bg-transparent"
                maxLength={6}
              />
              <button type="submit" disabled={loading} className="px-4 py-1 neu-btn text-primary-foreground text-sm font-semibold">
                Verify & Enable
              </button>
            </form>
          </div>
        )}
      </div>

      <div className="neu-flat p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 neu-btn rounded-xl">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <h2 className="font-semibold">Change Password</h2>
        </div>
        <form onSubmit={changePassword} className="space-y-3">
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current password"
            className="w-full px-3 py-2 neu-concave rounded-xl bg-transparent text-foreground text-sm"
            required
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password"
            className="w-full px-3 py-2 neu-concave rounded-xl bg-transparent text-foreground text-sm"
            required
            minLength={6}
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            className="w-full px-3 py-2 neu-concave rounded-xl bg-transparent text-foreground text-sm"
            required
          />
          <button type="submit" disabled={loading} className="px-4 py-2 neu-btn text-primary-foreground text-sm font-semibold">
            Change Password
          </button>
        </form>
      </div>
    </div>
  );
}
```

```tsx
// File: src\pages\admin\Setup.tsx
import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ROUTES } from "@/lib/routes";
import { apiFetch } from "@/lib/adminApi";
import { getPasswordErrors } from "@/lib/passwordValidation";
import { Shield } from "lucide-react";

export default function Setup() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [setupRequired, setSetupRequired] = useState<boolean | null>(null);
  const [form, setForm] = useState({
    username: "",
    password: "",
    confirmPassword: "",
    email: "",
    display_name: "",
  });

  const passwordErrors = getPasswordErrors(form.password);

  // Only render the setup form when the backend reports no admins exist.
  useEffect(() => {
    fetch(ROUTES.ADMINAPISETUPREQUIRED)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setSetupRequired(Boolean(data?.required)))
      .catch(() => setSetupRequired(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (passwordErrors.length > 0) {
      setError(`Password requirements not met: ${passwordErrors.join(", ")}`);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(ROUTES.ADMINAPISETUPCREATE, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.username,
          password: form.password,
          email: form.email || null,
          display_name: form.display_name || form.username,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Setup failed" }));
        throw new Error(typeof err.detail === "string" ? err.detail : "Setup failed");
      }
      navigate("/vega/admin/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed");
    } finally {
      setLoading(false);
    }
  }

  if (setupRequired === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Checking setup status...</p>
      </div>
    );
  }

  if (!setupRequired) {
    return <Navigate to="/vega/admin/login" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-card border shadow-sm p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-primary/10 rounded-xl">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Initial Setup</h1>
            <p className="text-sm text-muted-foreground">Create your owner account</p>
          </div>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Username *</label>
            <input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="text-sm font-medium">Display Name *</label>
            <input
              value={form.display_name}
              onChange={(e) => setForm({ ...form, display_name: e.target.value })}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium">Email (optional)</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Password *</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
              required
              minLength={12}
            />
            {form.password.length > 0 && passwordErrors.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {passwordErrors.map((rule) => (
                  <li key={rule}>• {rule}</li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <label className="text-sm font-medium">Confirm Password *</label>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
              required
            />
          </div>
          <button type="submit" disabled={loading} className="w-full py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
            {loading ? "Creating..." : "Create Owner Account"}
          </button>
        </form>
      </div>
    </div>
  );
}
```

```tsx
// File: src\pages\admin\Users.tsx
import { useState, useEffect } from "react";
import { ROUTES } from "../../lib/routes";
import { apiFetch } from "@/lib/adminApi";
import { getApiErrorMessage } from "@/lib/apiError";
import { isPasswordValid } from "@/lib/passwordValidation";
import { useAuth } from "../../contexts/AuthContext";
import {
  Users as UsersIcon,
  Plus,
  Search,
  MoreVertical,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Eye,
  EyeOff,
  UserCog,
  KeyRound,
  RefreshCw,
  Ban,
  CheckCircle,
  X,
  Check,
} from "lucide-react";

interface AdminUser {
  id: string;
  username: string;
  email: string | null;
  display_name: string;
  role: string;
  role_level: number | null;
  status: string;
  telegram_chat_id: string | null;
  totp_enabled: boolean;
  last_login_at: string | null;
  created_at: string | null;
  created_by: { id: string; username: string; display_name: string } | null;
}

interface RoleOption {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  level: number;
}

type AvailabilityStatus = "idle" | "checking" | "available" | "taken";

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  admin: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  manager: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  support: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  viewer: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400",
};

const ROLE_ICONS: Record<string, typeof Shield> = {
  owner: ShieldAlert,
  admin: ShieldCheck,
  manager: Shield,
  support: Shield,
  viewer: Eye,
};

function capitalizeRole(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export default function UsersPage() {
  const { admin: currentAdmin } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState<AdminUser | null>(null);
  const [showTotpSetup, setShowTotpSetup] = useState<AdminUser | null>(null);
  const [showResetPassword, setShowResetPassword] = useState<AdminUser | null>(null);
  const [showTotpReset, setShowTotpReset] = useState<AdminUser | null>(null);
  const [showDisable, setShowDisable] = useState<AdminUser | null>(null);
  const [showRevoke, setShowRevoke] = useState<AdminUser | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      const res = await apiFetch(ROUTES.ADMINAPIUSERS);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.items || []);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }

  const filtered = users.filter((u) => {
    if (search && !u.username.toLowerCase().includes(search.toLowerCase()) &&
        !u.display_name.toLowerCase().includes(search.toLowerCase())) return false;
    if (roleFilter && u.role !== roleFilter) return false;
    if (statusFilter && u.status !== statusFilter) return false;
    return true;
  });

  const canManage = ["owner", "admin", "manager"].includes(currentAdmin?.role || "");

  function canManageTarget(user: AdminUser): boolean {
    if (!currentAdmin) return false;
    if (currentAdmin.role === "owner") return true;
    const mine = currentAdmin.role_level;
    const theirs = user.role_level;
    if (mine == null || theirs == null) return currentAdmin.role === "admin";
    return mine > theirs;
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <UsersIcon className="w-6 h-6" />
            Users
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {users.length} administrator accounts
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 neu-btn text-primary-foreground text-sm font-semibold"
          >
            <Plus className="w-4 h-4" />
            Create User
          </button>
        )}
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 neu-concave rounded-xl bg-transparent text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2 neu-concave rounded-xl bg-transparent text-foreground text-sm"
        >
          <option value="">All Roles</option>
          {Array.from(new Set(users.map((u) => u.role))).sort().map((role) => (
            <option key={role} value={role}>{capitalizeRole(role)}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 neu-concave rounded-xl bg-transparent text-foreground text-sm"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
        </select>
      </div>

      <div className="neu-flat overflow-hidden text-foreground">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/30 border-b border-border/50">
              <th className="text-left px-4 py-3 text-sm font-semibold text-foreground">User</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-foreground">Name</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-foreground">Role</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-foreground">Status</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-foreground">Created By</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-foreground">2FA</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-foreground">Last Login</th>
              {canManage && <th className="w-10"></th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={canManage ? 8 : 7} className="text-center py-8 text-muted-foreground">Loading...</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={canManage ? 8 : 7} className="text-center py-8 text-muted-foreground">No users found</td>
              </tr>
            ) : (
              filtered.map((user) => {
                const RoleIcon = ROLE_ICONS[user.role] || Shield;
                const manageAllowed = canManage && canManageTarget(user);
                return (
                  <tr key={user.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-medium text-sm">{user.username}</span>
                    </td>
                    <td className="px-4 py-3 text-sm">{user.display_name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[user.role] || ""}`}>
                        <RoleIcon className="w-3 h-3" />
                        {capitalizeRole(user.role)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        user.status === "active"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      }`}>
                        {user.status === "active" ? <CheckCircle className="w-3 h-3" /> : <Ban className="w-3 h-3" />}
                        {user.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {user.created_by
                        ? (user.created_by.display_name || user.created_by.username)
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {user.totp_enabled ? (
                        <span className="text-green-600 dark:text-green-400 font-medium">T+T</span>
                      ) : user.telegram_chat_id ? (
                        <span className="text-blue-600 dark:text-blue-400 font-medium">T</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {user.last_login_at
                        ? new Date(user.last_login_at).toLocaleDateString()
                        : "Never"}
                    </td>
                    {manageAllowed && (
                      <td className="px-4 py-3 relative">
                        <button
                          onClick={() => setOpenMenuId(openMenuId === user.id ? null : user.id)}
                          className="p-1.5 rounded-xl hover:bg-muted/50 transition-colors"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {openMenuId === user.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                            <div className="absolute right-0 top-full mt-1 z-50 w-52 neu-convex py-1">
                              <MenuItem icon={UserCog} label="Edit" onClick={() => { setShowEdit(user); setOpenMenuId(null); }} />
                              <MenuItem icon={KeyRound} label="Configure TOTP" onClick={() => { setShowTotpSetup(user); setOpenMenuId(null); }} />
                              <MenuItem icon={RefreshCw} label="Reset Password" onClick={() => { setShowResetPassword(user); setOpenMenuId(null); }} />
                              <MenuItem icon={RefreshCw} label="Reset TOTP" onClick={() => { setShowTotpReset(user); setOpenMenuId(null); }} danger={user.totp_enabled} />
                              <MenuItem icon={Ban} label="Revoke Sessions" onClick={() => { setShowRevoke(user); setOpenMenuId(null); }} />
                              {user.status === "active" ? (
                                <MenuItem icon={Ban} label="Disable User" onClick={() => { setShowDisable(user); setOpenMenuId(null); }} danger />
                              ) : (
                                <MenuItem icon={CheckCircle} label="Enable User" onClick={async () => {
                                  await apiFetch(ROUTES.ADMINAPIUSERENABLE(user.id), { method: "POST" });
                                  loadUsers();
                                  setOpenMenuId(null);
                                }} />
                              )}
                            </div>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <CreateUserDialog onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); loadUsers(); }} />
      )}
      {showEdit && (
        <EditUserDialog user={showEdit} onClose={() => setShowEdit(null)} onUpdated={() => { setShowEdit(null); loadUsers(); }} />
      )}
      {showTotpSetup && (
        <TotpSetupDialog user={showTotpSetup} onClose={() => setShowTotpSetup(null)} onDone={() => { setShowTotpSetup(null); loadUsers(); }} />
      )}
      {showResetPassword && (
        <ResetPasswordDialog user={showResetPassword} onClose={() => setShowResetPassword(null)} onDone={() => { setShowResetPassword(null); loadUsers(); }} />
      )}
      {showTotpReset && (
        <ConfirmDialog
          title="Reset TOTP"
          message="This will invalidate the user's authenticator configuration and require TOTP enrollment again."
          confirmLabel="Reset TOTP"
          danger
          onClose={() => setShowTotpReset(null)}
          onConfirm={async () => {
            await apiFetch(ROUTES.ADMINAPIUSERTOTPRESET(showTotpReset.id), { method: "POST" });
            setShowTotpReset(null);
            loadUsers();
          }}
        />
      )}
      {showDisable && (
        <ConfirmDialog
          title={`Disable ${showDisable.username}?`}
          message="The user will be logged out immediately and cannot log in until re-enabled."
          confirmLabel="Disable"
          danger
          onClose={() => setShowDisable(null)}
          onConfirm={async () => {
            await apiFetch(ROUTES.ADMINAPIUSERDISABLE(showDisable.id), { method: "POST" });
            setShowDisable(null);
            loadUsers();
          }}
        />
      )}
      {showRevoke && (
        <ConfirmDialog
          title={`Revoke sessions for ${showRevoke.username}?`}
          message="All active sessions for this user will be terminated."
          confirmLabel="Revoke"
          onClose={() => setShowRevoke(null)}
          onConfirm={async () => {
            await apiFetch(ROUTES.ADMINAPIUSERREVOKE(showRevoke.id), { method: "POST" });
            setShowRevoke(null);
          }}
        />
      )}
    </div>
  );
}

function MenuItem({ icon: Icon, label, onClick, danger }: { icon: typeof Shield; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-muted/30 transition-colors ${
        danger ? "text-red-600 dark:text-red-400" : ""
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

function useAssignableRoles(): RoleOption[] {
  const { admin: currentAdmin } = useAuth();
  const [roles, setRoles] = useState<RoleOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    apiFetch(ROUTES.ADMINAPIROLES)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.items) return;
        const items: RoleOption[] = data.items;
        if (currentAdmin?.role === "owner") {
          setRoles(items);
        } else {
          const mine = currentAdmin?.role_level ?? null;
          setRoles(mine == null ? items : items.filter((r) => r.level < mine));
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [currentAdmin?.role, currentAdmin?.role_level]);

  return roles;
}

function CreateUserDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    username: "", display_name: "", email: "", password: "", confirmPassword: "", role: "support", telegram_chat_id: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [usernameStatus, setUsernameStatus] = useState<AvailabilityStatus>("idle");
  const [emailStatus, setEmailStatus] = useState<AvailabilityStatus>("idle");
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const roles = useAssignableRoles();

  useEffect(() => {
    const value = form.username.trim();
    if (value.length < 3) {
      setUsernameStatus("idle");
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    setUsernameStatus("checking");
    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch(
          `${ROUTES.ADMINAPIUSERSAVAILABILITY}?username=${encodeURIComponent(value)}`
        );
        if (cancelled || !res.ok) {
          if (!cancelled) setUsernameStatus("idle");
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        const u = data.username;
        setUsernameStatus(u?.available ? "available" : u?.taken ? "taken" : "idle");
        setSuggestions(u?.suggestions || []);
      } catch {
        if (!cancelled) setUsernameStatus("idle");
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [form.username]);

  useEffect(() => {
    const value = form.email.trim();
    if (!value) {
      setEmailStatus("idle");
      return;
    }
    let cancelled = false;
    setEmailStatus("checking");
    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch(
          `${ROUTES.ADMINAPIUSERSAVAILABILITY}?email=${encodeURIComponent(value)}`
        );
        if (cancelled || !res.ok) {
          if (!cancelled) setEmailStatus("idle");
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        const e = data.email;
        setEmailStatus(e?.available ? "available" : e?.taken ? "taken" : "idle");
      } catch {
        if (!cancelled) setEmailStatus("idle");
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [form.email]);

  const passwordsMatch =
    form.confirmPassword.length > 0 && form.password === form.confirmPassword;

  const availabilityBlocked =
    usernameStatus === "taken" || emailStatus === "taken";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch(ROUTES.ADMINAPIUSERSCREATE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.username,
          display_name: form.display_name,
          email: form.email || undefined,
          password: form.password,
          role: form.role,
          telegram_chat_id: form.telegram_chat_id || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(getApiErrorMessage(data, "Failed to create user"));
        return;
      }
      onCreated();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog onClose={onClose}>
      <h2 className="text-lg font-semibold mb-4">Create Admin User</h2>
      {error && <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl text-sm">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <AvailabilityInput
            label="Username *"
            value={form.username}
            onChange={(v) => setForm({ ...form, username: v })}
            placeholder="3-64 characters"
            status={usernameStatus}
          />
          {usernameStatus === "available" && (
            <p className="mt-1 text-xs text-green-600 dark:text-green-400">Username available</p>
          )}
          {usernameStatus === "taken" && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">Username already taken</p>
          )}
          {usernameStatus === "taken" && suggestions.length > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Try:</span>
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setForm({ ...form, username: s })}
                  className="px-2 py-0.5 rounded-lg neu-concave text-xs text-foreground hover:bg-muted/40 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
        <NeuInput label="Display Name *" value={form.display_name} onChange={(v) => setForm({ ...form, display_name: v })} />
        <div>
          <AvailabilityInput
            label="Email"
            type="email"
            value={form.email}
            onChange={(v) => setForm({ ...form, email: v })}
            status={emailStatus}
          />
          {emailStatus === "available" && (
            <p className="mt-1 text-xs text-green-600 dark:text-green-400">Email available</p>
          )}
          {emailStatus === "taken" && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">Email already registered</p>
          )}
        </div>
        <div>
          <PasswordInput
            label="Password *"
            value={form.password}
            onChange={(v) => setForm({ ...form, password: v })}
            visible={showPassword}
            onToggle={() => setShowPassword((v) => !v)}
          />
          <PasswordRequirements password={form.password} username={form.username} />
        </div>
        <div>
          <PasswordInput
            label="Confirm Password *"
            value={form.confirmPassword}
            onChange={(v) => setForm({ ...form, confirmPassword: v })}
            visible={showConfirmPassword}
            onToggle={() => setShowConfirmPassword((v) => !v)}
          />
          <MatchIndicator match={passwordsMatch} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Role *</label>
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full px-3 py-2 neu-concave rounded-xl bg-transparent text-sm">
            {!roles.some((r) => r.name === form.role) && (
              <option value={form.role}>{capitalizeRole(form.role)}</option>
            )}
            {roles.map((r) => (
              <option key={r.id} value={r.name}>{capitalizeRole(r.name)}</option>
            ))}
          </select>
        </div>
        <NeuInput label="Telegram Chat ID" value={form.telegram_chat_id} onChange={(v) => setForm({ ...form, telegram_chat_id: v })} placeholder="e.g. 123456789" />
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm neu-btn text-foreground">Cancel</button>
          <button type="submit" disabled={
            loading ||
            !form.username ||
            !form.display_name ||
            availabilityBlocked ||
            !(isPasswordValid(form.password, form.username) && form.password === form.confirmPassword)
          } className="px-4 py-2 text-sm neu-btn text-primary-foreground font-semibold disabled:opacity-50">
            {loading ? "Creating..." : "Create User"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function EditUserDialog({ user, onClose, onUpdated }: { user: AdminUser; onClose: () => void; onUpdated: () => void }) {
  const { admin: currentAdmin } = useAuth();
  const [form, setForm] = useState({ display_name: user.display_name, email: user.email || "", role: user.role });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const roles = useAssignableRoles();
  const isSelf = currentAdmin?.id === user.id;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiFetch(ROUTES.ADMINAPIUSERSBYID(user.id), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(getApiErrorMessage(data, "Failed to update"));
        return;
      }
      onUpdated();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog onClose={onClose}>
      <h2 className="text-lg font-semibold mb-4">Edit {user.username}</h2>
      {error && <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl text-sm">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-3">
        <NeuInput label="Display Name" value={form.display_name} onChange={(v) => setForm({ ...form, display_name: v })} />
        <NeuInput label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
        <div>
          <label className="block text-sm font-medium mb-1">Role</label>
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            disabled={isSelf}
            title={isSelf ? "You cannot change your own role" : undefined}
            className="w-full px-3 py-2 neu-concave rounded-xl bg-transparent text-sm disabled:opacity-50"
          >
            {!roles.some((r) => r.name === form.role) && (
              <option value={form.role}>{capitalizeRole(form.role)}</option>
            )}
            {roles.map((r) => (
              <option key={r.id} value={r.name}>{capitalizeRole(r.name)}</option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm neu-btn text-foreground">Cancel</button>
          <button type="submit" disabled={loading} className="px-4 py-2 text-sm neu-btn text-primary-foreground font-semibold disabled:opacity-50">
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function TotpSetupDialog({ user, onClose, onDone }: { user: AdminUser; onClose: () => void; onDone: () => void }) {
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"loading" | "scan" | "done">("loading");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch(ROUTES.ADMINAPIUSERTOTPSETUP(user.id))
      .then((r) => r.json())
      .then((data) => {
        setSecret(data.secret);
        setStep("scan");
      })
      .catch(() => setError("Failed to load TOTP setup"));
  }, [user.id]);

  async function handleEnable() {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(ROUTES.ADMINAPIUSERTOTPENABLE(user.id), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(getApiErrorMessage(data, "Invalid code"));
        return;
      }
      setStep("done");
      setTimeout(onDone, 1000);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog onClose={onClose}>
      <h2 className="text-lg font-semibold mb-4">Configure TOTP for {user.username}</h2>
      {error && <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl text-sm">{error}</div>}

      {step === "loading" && <p className="text-muted-foreground text-sm">Loading...</p>}

      {step === "scan" && (
        <>
          <p className="text-sm text-muted-foreground mb-3">
            Add this account to your authenticator app (Google Authenticator, Authy, etc.):
          </p>
          <div className="neu-concave p-3 rounded-xl mb-3">
            <p className="text-xs text-muted-foreground mb-1">Secret (manual entry):</p>
            <code className="text-sm font-mono break-all">{secret}</code>
          </div>
          <div className="mb-3">
            <label className="block text-sm font-medium mb-1">Enter 6-digit code from authenticator</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="000000"
              maxLength={6}
              className="w-full px-3 py-2 neu-concave rounded-xl bg-transparent text-foreground text-sm font-mono"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm neu-btn text-foreground">Cancel</button>
            <button onClick={handleEnable} disabled={loading || code.length !== 6} className="px-4 py-2 text-sm neu-btn text-primary-foreground font-semibold disabled:opacity-50">
              {loading ? "Verifying..." : "Verify & Enable"}
            </button>
          </div>
        </>
      )}

      {step === "done" && (
        <div className="text-center py-4">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
          <p className="font-medium">TOTP enabled successfully</p>
        </div>
      )}
    </Dialog>
  );
}

function ResetPasswordDialog({ user, onClose, onDone }: { user: AdminUser; onClose: () => void; onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const passwordsMatch = confirm.length > 0 && password === confirm;

  async function handleSubmit() {
    if (password !== confirm) { setError("Passwords do not match"); return; }
    setLoading(true);
    try {
      const res = await apiFetch(ROUTES.ADMINAPIUSERRESETPW(user.id), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_password: password }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(getApiErrorMessage(data, "Failed"));
        return;
      }
      onDone();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog onClose={onClose}>
      <h2 className="text-lg font-semibold mb-4">Reset Password for {user.username}</h2>
      {error && <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl text-sm">{error}</div>}
      <p className="text-sm text-muted-foreground mb-3">The user will be logged out after password reset.</p>
      <div>
        <PasswordInput
          label="New Password"
          value={password}
          onChange={setPassword}
          visible={showPassword}
          onToggle={() => setShowPassword((v) => !v)}
        />
        <PasswordRequirements password={password} username={user.username} />
      </div>
      <div>
        <PasswordInput
          label="Confirm Password"
          value={confirm}
          onChange={setConfirm}
          visible={showConfirm}
          onToggle={() => setShowConfirm((v) => !v)}
        />
        <MatchIndicator match={passwordsMatch} />
      </div>
      <div className="flex justify-end gap-2 pt-3">
        <button onClick={onClose} className="px-4 py-2 text-sm neu-btn text-foreground">Cancel</button>
        <button onClick={handleSubmit} disabled={loading || !isPasswordValid(password, user.username) || password !== confirm} className="px-4 py-2 text-sm neu-btn text-primary-foreground font-semibold disabled:opacity-50">
          {loading ? "Resetting..." : "Reset Password"}
        </button>
      </div>
    </Dialog>
  );
}

function ConfirmDialog({ title, message, confirmLabel, danger, onClose, onConfirm }: {
  title: string; message: string; confirmLabel: string; danger?: boolean;
  onClose: () => void; onConfirm: () => void;
}) {
  const [loading, setLoading] = useState(false);
  return (
    <Dialog onClose={onClose}>
      <h2 className="text-lg font-semibold mb-2">{title}</h2>
      <p className="text-sm text-muted-foreground mb-4">{message}</p>
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 text-sm neu-btn text-foreground">Cancel</button>
        <button
          onClick={async () => { setLoading(true); await onConfirm(); }}
          disabled={loading}
          className={`px-4 py-2 text-sm neu-btn text-white font-semibold disabled:opacity-50 ${
            danger ? "bg-destructive" : "bg-primary"
          }`}
        >
          {loading ? "..." : confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}

function PasswordInput({ label, value, onChange, visible, onToggle }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="new-password"
          className="w-full px-3 py-2 pr-11 neu-concave rounded-xl bg-transparent text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-xl text-muted-foreground hover:text-foreground transition-colors"
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

function AvailabilityInput({ label, type = "text", value, onChange, placeholder, status }: {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  status: AvailabilityStatus;
}) {
  const ring =
    status === "available"
      ? "ring-1 ring-green-500/50 focus:ring-green-500/60"
      : status === "taken"
        ? "ring-1 ring-red-500/50 focus:ring-red-500/60"
        : "focus:ring-primary/50";
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full px-3 py-2 pr-10 neu-concave rounded-xl bg-transparent text-foreground text-sm focus:outline-none focus:ring-2 ${ring}`}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          {status === "checking" && <RefreshCw className="w-4 h-4 text-muted-foreground animate-spin" />}
          {status === "available" && <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />}
          {status === "taken" && <X className="w-4 h-4 text-red-600 dark:text-red-400" />}
        </span>
      </div>
    </div>
  );
}

function MatchIndicator({ match }: { match: boolean | null }) {
  if (match === null) return null;
  return (
    <div className={`mt-1 flex items-center gap-1 text-xs ${
      match ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
    }`}>
      {match ? (
        <>
          <CheckCircle className="w-3.5 h-3.5" />
          Passwords match
        </>
      ) : (
        <>
          <X className="w-3.5 h-3.5" />
          Passwords do not match
        </>
      )}
    </div>
  );
}

function PasswordRequirements({ password, username }: { password: string; username: string }) {
  if (!password) return null;

  return (
    <div className="mt-1 space-y-1">
      {[
        { label: "At least 12 characters", ok: password.length >= 12 },
        { label: "Uppercase letter", ok: /[A-Z]/.test(password) },
        { label: "Lowercase letter", ok: /[a-z]/.test(password) },
        { label: "Number", ok: /[0-9]/.test(password) },
        { label: "Special character", ok: /[^A-Za-z0-9]/.test(password) },
        { label: "No leading/trailing whitespace", ok: password === password.trim() },
        { label: "Not the same as username", ok: !username || password.toLowerCase() !== username.toLowerCase() },
      ].map((r) => (
        <div key={r.label} className="flex items-center gap-1.5 text-xs">
          {r.ok ? (
            <Check className="w-3 h-3 text-green-500" />
          ) : (
            <X className="w-3 h-3 text-red-400" />
          )}
          <span className={r.ok ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}>
            {r.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function Dialog({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative neu-convex w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-muted/50 transition-colors">
          <X className="w-4 h-4" />
        </button>
        {children}
      </div>
    </div>
  );
}

function NeuInput({ label, type = "text", value, onChange, placeholder }: {
  label: string; type?: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 neu-concave rounded-xl bg-transparent text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
      />
    </div>
  );
}
```

```tsx
// File: src\pages\AdminLogin.tsx
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { RateLimitError } from "../contexts/AuthContext";
import OtpDigitInput from "../components/OtpDigitInput";
import {
  ArrowRight, Loader2, Shield, MessageSquare, KeyRound,
  Clock, AlertTriangle, Lock,
} from "lucide-react";

type Step = "credentials" | "otp" | "totp";

function CooldownTimer({
  seconds,
  maxSeconds,
  variant,
}: {
  seconds: number;
  maxSeconds: number;
  variant: "warning" | "danger";
}) {
  const pct = maxSeconds > 0 ? (seconds / maxSeconds) * 100 : 0;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  const colors =
    variant === "danger"
      ? {
          bg: "bg-red-50 dark:bg-red-950/30",
          border: "border-red-200 dark:border-red-800/40",
          text: "text-red-700 dark:text-red-400",
          bar: "bg-red-500 dark:bg-red-400",
          icon: "text-red-500 dark:text-red-400",
        }
      : {
          bg: "bg-amber-50 dark:bg-amber-950/30",
          border: "border-amber-200 dark:border-amber-800/40",
          text: "text-amber-700 dark:text-amber-400",
          bar: "bg-amber-500 dark:bg-amber-400",
          icon: "text-amber-500 dark:text-amber-400",
        };

  return (
    <div className={`rounded-xl border p-4 ${colors.bg} ${colors.border}`}>
      <div className="flex items-center gap-3 mb-3">
        {variant === "danger" ? (
          <Lock className={`w-5 h-5 ${colors.icon}`} />
        ) : (
          <Clock className={`w-5 h-5 ${colors.icon}`} />
        )}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${colors.text}`}>
            {variant === "danger" ? "Account temporarily locked" : "Please wait"}
          </p>
          <p className={`text-xs mt-0.5 ${colors.text} opacity-80`}>
            Too many failed attempts
          </p>
        </div>
        <span className={`text-2xl font-bold tabular-nums ${colors.text}`}>
          {timeStr}
        </span>
      </div>
      <div className={`h-1.5 rounded-full overflow-hidden ${variant === "danger" ? "bg-red-100 dark:bg-red-900/40" : "bg-amber-100 dark:bg-amber-900/40"}`}>
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-linear ${colors.bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function AdminLogin() {
  const { login, loginOtpSend, loginOtpVerify, loginTotp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from =
    (location.state as { from?: string } | null)?.from ??
    "/vega/admin/dashboard";

  const [step, setStep] = useState<Step>("credentials");
  const [transitioning, setTransitioning] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [challengeId, setChallengeId] = useState("");

  const [otpCode, setOtpCode] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [otpError, setOtpError] = useState(false);
  const [totpError, setTotpError] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Rate limit cooldown state
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [cooldownMax, setCooldownMax] = useState(0);
  const [cooldownType, setCooldownType] = useState<"rate_limited" | "account_locked">("rate_limited");
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearCooldownTimer = useCallback(() => {
    if (cooldownRef.current) {
      clearInterval(cooldownRef.current);
      cooldownRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearCooldownTimer();
  }, [clearCooldownTimer]);

  useEffect(() => {
    if (cooldownSeconds <= 0) {
      clearCooldownTimer();
      return;
    }
    cooldownRef.current = setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev <= 1) {
          clearCooldownTimer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearCooldownTimer();
  }, [cooldownMax, clearCooldownTimer]);

  function transitionTo(nextStep: Step) {
    setTransitioning(true);
    setTimeout(() => {
      setStep(nextStep);
      setTransitioning(false);
    }, 150);
  }

  function handleCooldownError(err: RateLimitError) {
    setCooldownSeconds(err.retryAfter);
    setCooldownMax(err.retryAfter);
    setCooldownType(
      err.limitType === "account_locked" ? "account_locked" : "rate_limited"
    );
    setError("");
  }

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await login(username, password);
      setChallengeId(result.challenge_id);

      if (result.methods.includes("totp") && !result.methods.includes("telegram_otp")) {
        transitionTo("totp");
      } else if (result.methods.includes("telegram_otp")) {
        transitionTo("otp");
        startResendCooldown();
      } else {
        setError("No second-factor method configured for this account");
      }
    } catch (err) {
      if (err instanceof RateLimitError) {
        handleCooldownError(err);
      } else {
        setError(err instanceof Error ? err.message : "Login failed");
      }
    } finally {
      setLoading(false);
    }
  }

  function startResendCooldown() {
    setResendCooldown(60);
    const interval = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  async function handleResendOtp() {
    if (resendCooldown > 0) return;
    setError("");
    try {
      const result = await loginOtpSend(challengeId);
      setResendCooldown(result.cooldown_seconds);
      startResendCooldown();
    } catch (err) {
      if (err instanceof RateLimitError) {
        handleCooldownError(err);
      } else {
        setError(err instanceof Error ? err.message : "Failed to resend code");
      }
    }
  }

  async function handleOtpVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setOtpError(false);
    try {
      const result = await loginOtpVerify(challengeId, otpCode);
      if (result.totpRequired && result.challenge_id) {
        setChallengeId(result.challenge_id);
        setTotpCode("");
        transitionTo("totp");
      } else {
        navigate(from, { replace: true });
      }
    } catch (err) {
      setOtpError(true);
      if (err instanceof RateLimitError) {
        handleCooldownError(err);
      } else {
        setError(err instanceof Error ? err.message : "Invalid code");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleTotpVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setTotpError(false);
    try {
      await loginTotp(challengeId, totpCode);
      navigate(from, { replace: true });
    } catch (err) {
      setTotpError(true);
      if (err instanceof RateLimitError) {
        handleCooldownError(err);
      } else {
        setError(err instanceof Error ? err.message : "Invalid code");
      }
    } finally {
      setLoading(false);
    }
  }

  const isLocked = cooldownSeconds > 0;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[var(--color-cream)] via-[var(--color-cream)] to-[var(--color-pink-muted)] p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 neu-convex rounded-2xl mb-4">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Admin Panel</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {step === "credentials" && "Sign in to your account"}
            {step === "otp" && "Enter the code sent to Telegram"}
            {step === "totp" && "Enter your authenticator code"}
          </p>
        </div>

        <div className="neu-convex p-8">
          {isLocked && (
            <div className="mb-4">
              <CooldownTimer
                seconds={cooldownSeconds}
                maxSeconds={cooldownMax}
                variant={cooldownType === "account_locked" ? "danger" : "warning"}
              />
            </div>
          )}

          {error && !isLocked && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="relative overflow-hidden">
            {step === "credentials" && (
              <div className={transitioning ? "login-step-exit" : "login-step-active"}>
                <form onSubmit={handleCredentials} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Username</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full px-4 py-2.5 neu-concave rounded-xl bg-transparent text-night-800 dark:text-cream-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      required
                      autoFocus
                      disabled={isLocked}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-2.5 neu-concave rounded-xl bg-transparent text-night-800 dark:text-cream-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      required
                      disabled={isLocked}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading || isLocked}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 neu-btn text-primary-foreground font-semibold text-sm disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                    {loading ? "Signing in..." : isLocked ? `Locked — wait ${cooldownSeconds}s` : "Sign In"}
                  </button>
                </form>
              </div>
            )}

            {step === "otp" && (
              <div className={transitioning ? "login-step-exit" : "login-step-active"}>
                <form onSubmit={handleOtpVerify} className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <MessageSquare className="w-4 h-4" />
                    <span>Code sent to your Telegram</span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-center">OTP Code</label>
                    <OtpDigitInput
                      value={otpCode}
                      onChange={(v) => {
                        setOtpCode(v);
                        setOtpError(false);
                      }}
                      autoFocus
                      disabled={isLocked}
                      error={otpError}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading || otpCode.length !== 6 || isLocked}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 neu-btn text-primary-foreground font-semibold text-sm disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                    {loading ? "Verifying..." : "Verify Code"}
                  </button>
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resendCooldown > 0 || isLocked}
                    className="w-full text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
                  >
                    {resendCooldown > 0
                      ? `Resend code in ${resendCooldown}s`
                      : "Resend code"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { transitionTo("credentials"); setOtpCode(""); setError(""); setCooldownSeconds(0); }}
                    className="w-full text-sm text-muted-foreground hover:text-foreground"
                  >
                    Back to login
                  </button>
                </form>
              </div>
            )}

            {step === "totp" && (
              <div className={transitioning ? "login-step-exit" : "login-step-active"}>
                <form onSubmit={handleTotpVerify} className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <KeyRound className="w-4 h-4" />
                    <span>Enter code from your authenticator app</span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-center">TOTP Code</label>
                    <OtpDigitInput
                      value={totpCode}
                      onChange={(v) => {
                        setTotpCode(v);
                        setTotpError(false);
                      }}
                      autoFocus
                      disabled={isLocked}
                      error={totpError}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading || totpCode.length !== 6 || isLocked}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 neu-btn text-primary-foreground font-semibold text-sm disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                    {loading ? "Verifying..." : "Verify & Sign In"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { transitionTo("credentials"); setTotpCode(""); setError(""); setCooldownSeconds(0); }}
                    className="w-full text-sm text-muted-foreground hover:text-foreground"
                  >
                    Back to login
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

```tsx
// File: src\pages\Apps.tsx
import { site } from "@/config/site";

const categoryColors: Record<string, string> = {
  Android: "bg-glow-500",
  Web: "bg-mist-500",
};

const statusConfig: Record<string, { label: string; className: string }> = {
  live: { label: "Live", className: "status-live" },
  beta: { label: "Beta", className: "status-beta" },
  "coming-soon": { label: "Coming Soon", className: "status-coming-soon" },
};

function ShareIcon() {
  return (
    <svg
      className="h-7 w-7 text-glow-500"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z"
      />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg
      className="h-7 w-7 text-mist-500"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"
      />
    </svg>
  );
}

const iconMap: Record<string, React.FC> = {
  share: ShareIcon,
  building: BuildingIcon,
};

export default function Apps() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-20">
      <h1 className="text-3xl md:text-4xl font-bold text-night-800 dark:text-cream-50 mb-4">
        Apps
      </h1>
      <p className="text-night-800/70 dark:text-cream-100/70 max-w-2xl mb-12">
        Applications I have developed — from mobile utilities to web management
        tools. Each app solves a specific problem with a clean, focused solution.
      </p>

      <div className="grid sm:grid-cols-2 gap-6">
        {site.apps.map((app, i) => {
          const Icon = iconMap[app.icon ?? ""] ?? ShareIcon;
          const status = statusConfig[app.status] ?? statusConfig["coming-soon"]!;
          return (
            <div
              key={app.title}
              className="reveal p-6 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700 flex flex-col"
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              {/* Header */}
              <div className="flex items-center gap-3 mb-3">
                {"logo" in app && app.logo ? (
                  <img src={app.logo} alt={`${app.title} logo`} className="h-7 w-7 rounded-lg object-contain" />
                ) : (
                  <Icon />
                )}
                <span
                  className={`h-2 w-2 rounded-full ${categoryColors[app.category] ?? "bg-glow-500"}`}
                />
                <span className="text-xs font-medium text-night-800/50 dark:text-cream-100/50 uppercase tracking-wide">
                  {app.category}
                </span>
                <span className={`ml-auto text-xs px-2.5 py-0.5 rounded-full font-medium ${status.className}`}>
                  {status.label}
                </span>
              </div>

              {/* Title + Description */}
              <h3 className="font-semibold text-night-800 dark:text-cream-50 mb-2">
                {app.title}
              </h3>
              <p className="text-sm text-night-800/60 dark:text-cream-100/60 mb-4">
                {app.description}
              </p>

              {/* Screenshots */}
              {"screenshots" in app && app.screenshots && app.screenshots.length > 0 ? (
                <div className={`grid ${app.screenshots.length > 1 ? "grid-cols-2" : "grid-cols-1"} gap-2 mb-4`}>
                  {app.screenshots.map((src: string, idx: number) => (
                    <img
                      key={idx}
                      src={src}
                      alt={`${app.title} screenshot ${idx + 1}`}
                      className="h-36 w-full rounded-xl object-cover border border-cream-300 dark:border-night-600"
                    />
                  ))}
                </div>
              ) : (
                <div className="h-36 rounded-xl bg-cream-200 dark:bg-night-700 flex items-center justify-center mb-4 border border-cream-300 dark:border-night-600">
                  <span className="text-xs text-night-800/30 dark:text-cream-100/30">
                    Screenshot coming soon
                  </span>
                </div>
              )}

              {/* Features */}
              <ul className="text-sm text-night-800/60 dark:text-cream-100/60 mb-4 space-y-1.5 flex-1">
                {app.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1 w-1 rounded-full bg-glow-500 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              {/* Tech Stack */}
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-night-800/40 dark:text-cream-100/40 mb-2">
                  Tech Stack
                </p>
                <div className="flex flex-wrap gap-2">
                  {app.techStack.map((t) => (
                    <span
                      key={t}
                      className="text-xs px-2.5 py-1 rounded-full bg-glow-500/10 border border-glow-500/20 text-glow-600 dark:text-glow-400"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mb-4">
                {app.tags.map((t) => (
                  <span
                    key={t}
                    className="text-xs px-2.5 py-1 rounded-full bg-cream-200 dark:bg-night-700 text-night-800/70 dark:text-cream-100/70"
                  >
                    {t}
                  </span>
                ))}
              </div>

              {/* CTA */}
              <a
                href={app.link.url}
                target={app.link.url.startsWith("http") ? "_blank" : undefined}
                rel={app.link.url.startsWith("http") ? "noopener noreferrer" : undefined}
                className={`inline-block text-center px-5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  app.link.url.startsWith("http")
                    ? "btn-primary bg-glow-500 text-white hover:bg-glow-600"
                    : "btn-outline border border-cream-300 dark:border-night-600 text-night-800/70 dark:text-cream-100/70 hover:bg-cream-200 dark:hover:bg-night-700"
                }`}
              >
                {app.link.label}
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

```tsx
// File: src\pages\Contact.tsx
import { useRef, useState } from "react";
import { site } from "@/config/site";

function PhoneIcon() {
  return (
    <svg className="h-5 w-5 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg className="h-5 w-5 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg className="h-5 w-5 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg className="h-5 w-5 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="h-5 w-5 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="checklist-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

const ALLOWED_EXTENSIONS = [
  "pdf", "doc", "docx", "xls", "xlsx", "csv", "txt",
  "png", "jpg", "jpeg", "gif", "webp",
];
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_FILES = 5;

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function Contact() {
  const { contact, workingStyle, beforeContacting } = site;

  const [form, setForm] = useState({
    name: "",
    email: "",
    mobile: "",
    projectType: "Legal Research",
    priority: "standard",
    message: "",
    website: "", // honeypot
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [fileWarnings, setFileWarnings] = useState<string[]>([]);

  const setField = (field: string, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const addFiles = (incoming: File[]) => {
    const warnings: string[] = [];
    const next: File[] = [...files];
    for (const file of incoming) {
      const ext = file.name.includes(".")
        ? file.name.split(".").pop()!.toLowerCase()
        : "";
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        warnings.push(`${file.name} — unsupported file type. Use PDF, DOC, XLS, TXT, or an image.`);
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        warnings.push(`${file.name} — exceeds the 25MB limit.`);
        continue;
      }
      if (next.some((f) => f.name === file.name && f.size === file.size)) {
        continue;
      }
      if (next.length >= MAX_FILES) {
        warnings.push(`You can attach up to ${MAX_FILES} files.`);
        break;
      }
      next.push(file);
    }
    setFiles(next);
    setFileWarnings(warnings);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setFileWarnings([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSent(false);
    setFileWarnings([]);
    setSubmitting(true);
    try {
      const body = new FormData();
      body.append("name", form.name);
      body.append("email", form.email);
      body.append("mobile", form.mobile);
      body.append("project_type", form.projectType);
      body.append("priority", form.priority);
      body.append("message", form.message);
      body.append("website", form.website); // honeypot
      for (const file of files) {
        body.append("documents", file, file.name);
      }
      const res = await fetch("/api/vks/api/contact", {
        method: "POST",
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Could not send your message. Please try again.");
      }
      const skipped = Array.isArray(data?.skipped) ? data.skipped : [];
      setSent(true);
      setForm({
        name: "",
        email: "",
        mobile: "",
        projectType: "Legal Research",
        priority: "standard",
        message: "",
        website: "",
      });
      setFiles([]);
      setFileWarnings(skipped.length > 0 ? skipped.map((s: { filename?: string; reason?: string }) => {
        const reason = s.reason === "too_large" ? "exceeds the 25MB limit" : "unsupported file type";
        return `${s.filename ?? "A file"} was not delivered (${reason}).`;
      }) : []);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send your message.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-20">
      <h1 className="text-3xl md:text-4xl font-bold text-night-800 dark:text-cream-50 mb-4">
        Contact
      </h1>
      <p className="text-night-800/70 dark:text-cream-100/70 max-w-2xl mb-12">
        Ready to start a project? Reach out through any of the channels below.
        I typically respond within 24 hours.
      </p>

      <div className="grid lg:grid-cols-5 gap-8">
        {/* ── Left Column (3 cols) ──────────────── */}
        <div className="lg:col-span-3 space-y-8">
          {/* Contact Cards */}
          <div className="grid sm:grid-cols-2 gap-4">
            <a
              href={contact.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="card-hover flex items-center gap-3 p-5 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700 hover:border-glow-500 transition-colors"
            >
              <PhoneIcon />
              <div>
                <p className="text-xs text-night-800/50 dark:text-cream-100/50">WhatsApp</p>
                <p className="text-sm font-medium text-night-800 dark:text-cream-50">{contact.phone}</p>
              </div>
            </a>

            <a
              href={`mailto:${contact.email}`}
              className="card-hover flex items-center gap-3 p-5 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700 hover:border-glow-500 transition-colors"
            >
              <MailIcon />
              <div>
                <p className="text-xs text-night-800/50 dark:text-cream-100/50">Email</p>
                <p className="text-sm font-medium text-night-800 dark:text-cream-50">{contact.email}</p>
              </div>
            </a>

            <a
              href={contact.website}
              target="_blank"
              rel="noopener noreferrer"
              className="card-hover flex items-center gap-3 p-5 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700 hover:border-glow-500 transition-colors"
            >
              <GlobeIcon />
              <div>
                <p className="text-xs text-night-800/50 dark:text-cream-100/50">Website</p>
                <p className="text-sm font-medium text-night-800 dark:text-cream-50">{contact.website}</p>
              </div>
            </a>

            <div className="card-hover flex items-center gap-3 p-5 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700">
              <MapPinIcon />
              <div>
                <p className="text-xs text-night-800/50 dark:text-cream-100/50">Location</p>
                <p className="text-sm font-medium text-night-800 dark:text-cream-50">{contact.location}</p>
              </div>
            </div>
          </div>

          {/* Before You Contact */}
          <div className="reveal p-6 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700">
            <h2 className="text-lg font-semibold text-night-800 dark:text-cream-50 mb-4">
              Before You Contact
            </h2>
            <p className="text-sm text-night-800/60 dark:text-cream-100/60 mb-4">
              Having these ready helps us scope your project faster and give you a more accurate quote.
            </p>
            <ul className="space-y-3">
              {beforeContacting.map((item) => (
                <li key={item} className="checklist-item">
                  <CheckIcon />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Form */}
          <div className="reveal p-6 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700">
            <h2 className="text-lg font-semibold text-night-800 dark:text-cream-50 mb-4">
              Send a Message
            </h2>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-night-800/60 dark:text-cream-100/60 mb-1.5">
                    Name
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setField("name", e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-cream-50 dark:bg-night-900 border border-cream-200 dark:border-night-600 text-sm text-night-800 dark:text-cream-100 focus:outline-none focus:border-glow-500 transition-colors"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-night-800/60 dark:text-cream-100/60 mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setField("email", e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-cream-50 dark:bg-night-900 border border-cream-200 dark:border-night-600 text-sm text-night-800 dark:text-cream-100 focus:outline-none focus:border-glow-500 transition-colors"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-night-800/60 dark:text-cream-100/60 mb-1.5">
                    Mobile
                  </label>
                  <input
                    type="tel"
                    value={form.mobile}
                    onChange={(e) => setField("mobile", e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-cream-50 dark:bg-night-900 border border-cream-200 dark:border-night-600 text-sm text-night-800 dark:text-cream-100 focus:outline-none focus:border-glow-500 transition-colors"
                    placeholder="Your mobile number"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-night-800/60 dark:text-cream-100/60 mb-1.5">
                    Project Type
                  </label>
                  <select
                    value={form.projectType}
                    onChange={(e) => setField("projectType", e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-cream-50 dark:bg-night-900 border border-cream-200 dark:border-night-600 text-sm text-night-800 dark:text-cream-100 focus:outline-none focus:border-glow-500 transition-colors"
                  >
                    <option>Legal Research</option>
                    <option>Contract Drafting</option>
                    <option>Data Analysis</option>
                    <option>Legal-Tech Integration</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-night-800/60 dark:text-cream-100/60 mb-1.5">
                  Priority
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm text-night-800 dark:text-cream-100 cursor-pointer">
                    <input
                      type="radio"
                      name="priority"
                      value="standard"
                      checked={form.priority === "standard"}
                      onChange={() => setField("priority", "standard")}
                      className="accent-glow-500"
                    />
                    Standard
                  </label>
                  <label className="flex items-center gap-2 text-sm text-night-800 dark:text-cream-100 cursor-pointer">
                    <input
                      type="radio"
                      name="priority"
                      value="urgent"
                      checked={form.priority === "urgent"}
                      onChange={() => setField("priority", "urgent")}
                      className="accent-glow-500"
                    />
                    Urgent
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-night-800/60 dark:text-cream-100/60 mb-1.5">
                  Documents <span className="opacity-60">(optional)</span>
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={(e) => {
                    if (e.target.files) addFiles(Array.from(e.target.files));
                    e.target.value = "";
                  }}
                  className="w-full text-sm text-night-800/70 dark:text-cream-100/70 file:mr-3 file:rounded-xl file:border-0 file:bg-glow-500 file:px-4 file:py-2 file:text-xs file:font-medium file:text-white hover:file:bg-glow-600"
                />
                <p className="text-xs text-night-800/40 dark:text-cream-100/40 mt-1">
                  PDF, DOC, XLS, or images — up to 25MB each, max {MAX_FILES} files. You can add files in multiple steps.
                </p>
                {fileWarnings.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {fileWarnings.map((w) => (
                      <li key={w} className="text-xs text-red-600 dark:text-red-400">
                        {w}
                      </li>
                    ))}
                  </ul>
                )}
                {files.length > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {files.map((file, i) => (
                      <li
                        key={`${file.name}-${file.size}-${i}`}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-cream-50 dark:bg-night-900 border border-cream-200 dark:border-night-600 text-xs"
                      >
                        <span className="text-night-800 dark:text-cream-100 truncate flex-1">{file.name}</span>
                        <span className="text-night-800/40 dark:text-cream-100/40">{fmtBytes(file.size)}</span>
                        <button
                          type="button"
                          onClick={() => removeFile(i)}
                          aria-label={`Remove ${file.name}`}
                          className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-night-800/60 dark:text-cream-100/60 mb-1.5">
                  Message
                </label>
                <textarea
                  rows={4}
                  required
                  value={form.message}
                  onChange={(e) => setField("message", e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-cream-50 dark:bg-night-900 border border-cream-200 dark:border-night-600 text-sm text-night-800 dark:text-cream-100 focus:outline-none focus:border-glow-500 transition-colors resize-none"
                  placeholder="Tell me about your project..."
                />
              </div>

              {/* Honeypot — hidden from humans, bots fill it. */}
              <input
                type="text"
                value={form.website}
                onChange={(e) => setField("website", e.target.value)}
                className="hidden"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
              />

              {sent && (
                <p className="text-sm text-sage-500">
                  Thank you — your message has been sent. I'll get back to you within 24 hours.
                </p>
              )}
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="btn-primary px-6 py-2.5 rounded-xl bg-glow-500 text-white font-medium text-sm hover:bg-glow-600 disabled:opacity-50"
              >
                {submitting ? "Sending…" : "Send Message"}
              </button>
            </form>
          </div>
        </div>

        {/* ── Right Column (2 cols) ─────────────── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Response Time */}
          <div className="reveal card-hover p-6 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700">
            <div className="flex items-center gap-3 mb-3">
              <ClockIcon />
              <h3 className="font-semibold text-night-800 dark:text-cream-50">
                Response Time
              </h3>
            </div>
            <p className="text-2xl font-bold text-glow-600 dark:text-glow-400 mb-1">
              {workingStyle.responseTime}
            </p>
            <p className="text-sm text-night-800/60 dark:text-cream-100/60">
              I check messages regularly and aim to get back to you within one business day.
            </p>
          </div>

          {/* Working Style */}
          <div className="reveal card-hover p-6 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700">
            <h3 className="font-semibold text-night-800 dark:text-cream-50 mb-4">
              Working Style
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-night-800/40 dark:text-cream-100/40 mb-0.5">
                  Availability
                </p>
                <p className="text-sm text-night-800 dark:text-cream-100">{workingStyle.availability}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-night-800/40 dark:text-cream-100/40 mb-0.5">
                  Communication
                </p>
                <p className="text-sm text-night-800 dark:text-cream-100">{workingStyle.communication}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-night-800/40 dark:text-cream-100/40 mb-0.5">
                  Timezone
                </p>
                <p className="text-sm text-night-800 dark:text-cream-100">{workingStyle.timezone}</p>
              </div>
            </div>
          </div>

          {/* Confidentiality */}
          <div className="reveal card-hover p-6 rounded-2xl bg-glow-500/10 border border-glow-500/30">
            <p className="text-sm text-night-800 dark:text-cream-100">
              <strong className="text-glow-600 dark:text-glow-400">Confidentiality guaranteed.</strong>{" "}
              All communications and project details are handled under strict NDA. Your privacy is paramount.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

```tsx
// File: src\pages\Freelance.tsx
import { site } from "@/config/site";

function ScaleIcon() {
  return (
    <svg className="h-7 w-7 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.589-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.589-1.202L5.25 4.971z" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg className="h-7 w-7 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg className="h-7 w-7 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg className="h-7 w-7 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

const iconMap: Record<string, React.FC> = {
  scale: ScaleIcon,
  document: DocumentIcon,
  chart: ChartIcon,
  gear: GearIcon,
};

export default function Freelance() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-20">
      <h1 className="text-3xl md:text-4xl font-bold text-night-800 dark:text-cream-50 mb-4">
        Freelance Services
      </h1>
      <p className="text-night-800/70 dark:text-cream-100/70 max-w-2xl mb-12">
        Professional legal and tech services tailored to your needs. Each engagement
        starts with a clear scope, transparent pricing, and strict confidentiality.
      </p>

      {/* ── Services ────────────────────────────── */}
      <section className="mb-16">
        <div className="grid sm:grid-cols-2 gap-6">
          {site.services.map((s, i) => {
            const Icon = iconMap[s.icon] ?? ScaleIcon;
            return (
              <div
                key={s.title}
                className="reveal card-hover p-6 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700 flex flex-col"
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <Icon />
                <h3 className="mt-4 font-semibold text-night-800 dark:text-cream-50">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm text-night-800/60 dark:text-cream-100/60 leading-relaxed">
                  {s.description}
                </p>

                <div className="mt-5 pt-4 border-t border-cream-200 dark:border-night-700 space-y-3 flex-1">
                  {/* Ideal For */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-night-800/50 dark:text-cream-100/50 mb-1.5">
                      Ideal For
                    </p>
                    <ul className="space-y-1">
                      {s.idealFor.map((item) => (
                        <li key={item} className="flex items-start gap-2 text-sm text-night-800/70 dark:text-cream-100/70">
                          <span className="mt-1.5 h-1 w-1 rounded-full bg-glow-500 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Deliverables */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-night-800/50 dark:text-cream-100/50 mb-1.5">
                      Deliverables
                    </p>
                    <ul className="space-y-1">
                      {s.deliverables.map((item) => (
                        <li key={item} className="flex items-start gap-2 text-sm text-night-800/70 dark:text-cream-100/70">
                          <span className="mt-1.5 h-1 w-1 rounded-full bg-glow-500 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Turnaround + Pricing */}
                  <div className="flex flex-wrap gap-3 pt-2">
                    <span className="text-xs px-3 py-1.5 rounded-full bg-cream-200 dark:bg-night-700 text-night-800/70 dark:text-cream-100/70 font-medium">
                      {s.turnaround}
                    </span>
                    <span className="text-xs px-3 py-1.5 rounded-full bg-glow-500/10 border border-glow-500/20 text-glow-600 dark:text-glow-400 font-medium">
                      {s.pricingModel}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Working Principles ──────────────────── */}
      <section>
        <h2 className="text-xl font-semibold text-night-800 dark:text-cream-50 mb-6">
          Working Principles
        </h2>
        <div className="grid sm:grid-cols-2 gap-6">
          {site.principles.map((p, i) => (
            <div
              key={p.title}
              className="reveal card-hover p-5 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700"
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <h3 className="font-semibold text-glow-500 mb-2">{p.title}</h3>
              <p className="text-sm text-night-800/60 dark:text-cream-100/60 leading-relaxed">
                {p.description}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
```

```tsx
// File: src\pages\Home.tsx
import { Link } from "react-router-dom";
import { site } from "@/config/site";

function ScaleIcon({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg className={`${className} text-glow-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.589-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.589-1.202L5.25 4.971z" />
    </svg>
  );
}

function ChartIcon({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg className={`${className} text-glow-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

function ShieldIcon({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg className={`${className} text-glow-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

function CalendarIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={`${className} text-glow-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  );
}

function DiamondIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={`${className} text-glow-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  );
}

function MagnifierIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={`${className} text-glow-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  );
}

function BoltIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={`${className} text-glow-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  );
}

const highlightIconMap: Record<string, React.FC<{ className?: string }>> = {
  scale: ScaleIcon,
  chart: ChartIcon,
  shield: ShieldIcon,
};

const trustBadgeIconMap: Record<string, React.FC<{ className?: string }>> = {
  calendar: CalendarIcon,
  shield: ShieldIcon,
  diamond: DiamondIcon,
};

const whyHireIconMap: Record<string, React.FC<{ className?: string }>> = {
  shield: ShieldIcon,
  calendar: CalendarIcon,
  diamond: DiamondIcon,
  magnifier: MagnifierIcon,
  bolt: BoltIcon,
};

export default function Home() {
  return (
    <div>
      {/* ── Hero ──────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 py-20 md:py-28">
        <div className="grid md:grid-cols-5 gap-12 items-center">
          <div className="md:col-span-3">
            <p className="text-sm font-medium text-glow-500 mb-4 tracking-wide uppercase">
              {site.tagline}
            </p>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-night-800 dark:text-cream-50 mb-6 leading-tight">
              {site.name}
            </h1>
            <p className="text-lg text-night-800/70 dark:text-cream-100/70 max-w-xl mb-10 leading-relaxed">
              {site.description}
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                to="/freelance"
                className="btn-primary inline-block px-6 py-3 rounded-xl bg-glow-500 text-white font-medium hover:bg-glow-600 text-center"
              >
                View Services
              </Link>
              <Link
                to="/contact"
                className="btn-outline inline-block px-6 py-3 rounded-xl border border-cream-300 dark:border-night-600 font-medium hover:bg-cream-200 dark:hover:bg-night-700 text-center"
              >
                Get in Touch
              </Link>
            </div>
          </div>

          <div className="md:col-span-2 flex flex-col gap-4">
            {site.trustBadges.map((badge) => {
              const Icon = trustBadgeIconMap[badge.icon] ?? ShieldIcon;
              return (
                <div
                  key={badge.label}
                  className="card-hover flex items-center gap-4 p-5 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700"
                >
                  <Icon className="h-6 w-6" />
                  <span className="text-sm font-medium text-night-800 dark:text-cream-100">
                    {badge.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Trust Badges Row (mobile) ─────────────── */}
      <section className="md:hidden max-w-6xl mx-auto px-4 pb-12">
        <div className="flex gap-3 overflow-x-auto">
          {site.trustBadges.map((badge) => {
            const Icon = trustBadgeIconMap[badge.icon] ?? ShieldIcon;
            return (
              <div
                key={badge.label}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700 shrink-0"
              >
                <Icon className="h-4 w-4" />
                <span className="text-xs font-medium text-night-800 dark:text-cream-100 whitespace-nowrap">
                  {badge.label}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Highlights ────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 pb-20">
        <div className="grid md:grid-cols-3 gap-6">
          {site.highlights.map((h, i) => {
            const Icon = highlightIconMap[h.icon] ?? ScaleIcon;
            return (
              <div
                key={h.title}
                className="reveal card-hover p-6 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700"
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <Icon />
                <h3 className="mt-4 font-semibold text-night-800 dark:text-cream-50">
                  {h.title}
                </h3>
                <p className="mt-2 text-sm text-night-800/60 dark:text-cream-100/60">
                  {h.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Why Hire Me ───────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 pb-20">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-night-800 dark:text-cream-50">
            Why Hire Me
          </h2>
          <div className="mt-3 h-1 w-12 mx-auto rounded-full bg-glow-500" />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {site.whyHireMe.map((item, i) => {
            const Icon = whyHireIconMap[item.icon] ?? ShieldIcon;
            return (
              <div
                key={item.title}
                className="reveal card-hover p-6 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700"
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <Icon className="h-6 w-6" />
                <h3 className="mt-3 font-semibold text-night-800 dark:text-cream-50">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm text-night-800/60 dark:text-cream-100/60 leading-relaxed">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
```

```tsx
// File: src\pages\NotFound.tsx
import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-32 text-center">
      <p className="text-6xl font-bold text-glow-500 mb-4">404</p>
      <h1 className="text-2xl font-semibold text-night-800 dark:text-cream-50 mb-2">
        Page Not Found
      </h1>
      <p className="text-night-800/60 dark:text-cream-100/60 mb-8">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link
        to="/"
        className="inline-block px-6 py-3 rounded-xl bg-glow-500 text-white font-medium hover:bg-glow-600 transition-colors"
      >
        Back to Home
      </Link>
    </div>
  );
}
```

```tsx
// File: src\pages\Portfolio.tsx
import { site } from "@/config/site";

const categoryColors: Record<string, string> = {
  Legal: "bg-sage-500",
  Tech: "bg-mist-500",
};

const categoryBorderColors: Record<string, string> = {
  Legal: "border-l-sage-500",
  Tech: "border-l-mist-500",
};

export default function Portfolio() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-20">
      <h1 className="text-3xl md:text-4xl font-bold text-night-800 dark:text-cream-50 mb-4">
        Portfolio
      </h1>
      <p className="text-night-800/70 dark:text-cream-100/70 max-w-2xl mb-12">
        Selected projects across legal research and technology. Each project follows
        a structured approach: understand the problem, design the solution, deliver measurable outcomes.
      </p>

      <div className="grid sm:grid-cols-2 gap-6">
        {site.projects.map((p, i) => (
          <div
            key={p.title}
            className={`reveal p-6 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700 border-l-4 ${categoryBorderColors[p.category] ?? "border-l-glow-500"} flex flex-col`}
            style={{ transitionDelay: `${i * 80}ms` }}
          >
            <div className="flex items-center gap-2 mb-3">
              <span
                className={`h-2 w-2 rounded-full ${categoryColors[p.category] ?? "bg-glow-500"}`}
              />
              <span className="text-xs font-medium text-night-800/50 dark:text-cream-100/50 uppercase tracking-wide">
                {p.category}
              </span>
            </div>

            <h3 className="font-semibold text-night-800 dark:text-cream-50 mb-4">
              {p.title}
            </h3>

            <div className="space-y-3 flex-1">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-night-800/40 dark:text-cream-100/40 mb-1">
                  Problem
                </p>
                <p className="text-sm text-night-800/70 dark:text-cream-100/70 leading-relaxed">
                  {p.problem}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-night-800/40 dark:text-cream-100/40 mb-1">
                  Solution
                </p>
                <p className="text-sm text-night-800/70 dark:text-cream-100/70 leading-relaxed">
                  {p.solution}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-night-800/40 dark:text-cream-100/40 mb-1">
                  Outcome
                </p>
                <p className="text-sm text-night-800/70 dark:text-cream-100/70 leading-relaxed">
                  {p.outcome}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-cream-200 dark:border-night-700">
              {p.tags.map((t) => (
                <span
                  key={t}
                  className="text-xs px-2.5 py-1 rounded-full bg-cream-200 dark:bg-night-700 text-night-800/70 dark:text-cream-100/70"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

```typescript
// File: src\vite-env.d.ts
/// <reference types="vite/client" />
```

```json
// File: tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src", "vite-env.d.ts"]
}
```

```typescript
// File: vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  base: "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    hmr: { clientPort: 443 },
    proxy: {
      // Dev only: forward /api to the local FastAPI backend.
      // Production routes /api through the Cloudflare Pages function instead.
      "/api": {
        target: process.env.VITE_API_ORIGIN || "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
```
