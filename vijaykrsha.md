```yaml
// File: .cloudflare\config.yml
ingress:
  - hostname: api.vijaykrsha.online
    service: http://localhost:8000
  - service: http_status:404
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
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"
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
      - "9000:9000"
      - "9001:9001"
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
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
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql+asyncpg://postgres:${POSTGRES_PASSWORD:-postgres}@db:5432/vijaykrsha
      TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN}
      TELEGRAM_ADMIN_CHAT_ID: ${TELEGRAM_ADMIN_CHAT_ID}
      SESSION_SECRET: ${SESSION_SECRET:-change-me-in-production}
      TOTP_ENCRYPTION_KEY: ${TOTP_ENCRYPTION_KEY:-change-me-in-production}
      S3_ENDPOINT: http://storage:9000
      S3_ACCESS_KEY: ${MINIO_ACCESS_KEY:-minioadmin}
      S3_SECRET_KEY: ${MINIO_SECRET_KEY:-minioadmin}
      CORS_ORIGINS: ${CORS_ORIGINS:-https://vijaykrsha.online}

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

  const response = await fetch(proxyRequest);
  const newResponse = new Response(response.body, response);
  const headers = corsHeaders(origin);

  for (const [key, value] of Object.entries(headers)) {
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

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
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

```tsx
// File: src\App.tsx
import { Routes, Route } from "react-router-dom";
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
import AdminLayout from "@/pages/admin/AdminLayout";
import Dashboard from "@/pages/admin/Dashboard";
import Inbox from "@/pages/admin/Inbox";
import MessageDetail from "@/pages/admin/MessageDetail";
import Settings from "@/pages/admin/Settings";
import AdminUsersPage from "@/pages/admin/AdminUsers";
import AuditLogs from "@/pages/admin/AuditLogs";

export default function App() {
  return (
    <Routes>
      <Route path="/vega/admin/login" element={<AdminLogin />} />
      <Route path="/vega/admin/setup" element={<Setup />} />
      <Route path="/vega/admin" element={<AdminLayout />}>
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="inbox" element={<Inbox />} />
        <Route path="messages/:id" element={<MessageDetail />} />
        <Route path="settings" element={<Settings />} />
        <Route path="admin-users" element={<AdminUsersPage />} />
        <Route path="audit-logs" element={<AuditLogs />} />
        <Route index element={<Dashboard />} />
      </Route>
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
// File: src\components\ui\alert.tsx
import { type HTMLAttributes, forwardRef } from "react";

interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "destructive";
}

const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ className = "", variant = "default", ...props }, ref) => {
    const variants: Record<string, string> = {
      default: "bg-background text-foreground border",
      destructive:
        "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
    };
    return (
      <div
        ref={ref}
        role="alert"
        className={`relative w-full rounded-lg border p-4 ${variants[variant]} ${className}`}
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
      "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none h-10 px-4 py-2";
    const variants: Record<string, string> = {
      default: "bg-primary text-primary-foreground hover:bg-primary/90",
      destructive:
        "bg-destructive text-destructive-foreground hover:bg-destructive/90",
      outline:
        "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
      ghost: "hover:bg-accent hover:text-accent-foreground",
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
      className={`rounded-lg border bg-card text-card-foreground shadow-sm ${className}`}
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
        className="fixed inset-0 bg-black/80"
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
      className={`fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg rounded-lg border bg-background p-6 shadow-lg ${className}`}
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
        className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
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
      className={`inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground ${className}`}
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
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
        isActive
          ? "bg-background text-foreground shadow-sm"
          : "hover:text-foreground"
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
      className={`mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${className}`}
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

interface SecondFactorResult {
  status: "second_factor_required";
  challenge_id: string;
  methods: string[];
}

export class OtpCooldownError extends Error {
  cooldownSeconds: number;
  constructor(cooldownSeconds: number) {
    super(`Please wait ${cooldownSeconds}s before requesting a new code.`);
    this.cooldownSeconds = cooldownSeconds;
  }
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  admin: { id: string; username: string; role: string } | null;
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
  const [admin, setAdmin] = useState<{ id: string; username: string; role: string } | null>(null);

  useEffect(() => {
    fetch(ROUTES.ADMINAPIAUTHME, { credentials: "include" })
      .then((response) => {
        if (response.ok) return response.json();
        throw new Error("not authenticated");
      })
      .then((data) => {
        setIsAuthenticated(true);
        setAdmin(data);
      })
      .catch(() => {
        setIsAuthenticated(false);
        setAdmin(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(
    async (
      username: string,
      password: string,
      rememberMe = false
    ): Promise<SecondFactorResult> => {
      const response = await fetch(ROUTES.ADMINAPIAUTHLOGIN, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, remember_me: rememberMe }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: "Login failed" }));
        throw new Error(typeof err.detail === "string" ? err.detail : "Login failed");
      }

      return await response.json();
    },
    []
  );

  const loginOtpSend = useCallback(
    async (challengeId: string): Promise<{ cooldown_seconds: number }> => {
      const response = await fetch(ROUTES.ADMINAPIAUTHLOGINOTPSEND, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge_id: challengeId }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: "Failed to send code" }));
        const msg = typeof err.detail === "string" ? err.detail : "Failed to send code";
        if (msg.includes("resend_cooldown")) {
          const match = msg.match(/(\d+)/);
          throw new OtpCooldownError(match ? parseInt(match[1]) : 60);
        }
        throw new Error(msg);
      }

      return await response.json();
    },
    []
  );

  const loginOtpVerify = useCallback(
    async (challengeId: string, code: string) => {
      const response = await fetch(ROUTES.ADMINAPIAUTHLOGINOTPVERIFY, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge_id: challengeId, code }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: "OTP verification failed" }));
        throw new Error(typeof err.detail === "string" ? err.detail : "OTP verification failed");
      }

      const data = await response.json();
      if (data.status === "totp_required") {
        return { totpRequired: true, challenge_id: data.challenge_id };
      }

      setIsAuthenticated(true);
      setAdmin(data.admin ?? null);
      return { totpRequired: false };
    },
    []
  );

  const loginTotp = useCallback(
    async (challengeId: string, code: string) => {
      const response = await fetch(ROUTES.ADMINAPIAUTHLOGINTOTP, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge_id: challengeId, code }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: "TOTP verification failed" }));
        throw new Error(typeof err.detail === "string" ? err.detail : "TOTP verification failed");
      }

      const data = await response.json();
      setIsAuthenticated(true);
      setAdmin(data.admin ?? null);
    },
    []
  );

  const logout = useCallback(async () => {
    await fetch(ROUTES.ADMINAPIAUTHLOGOUT, {
      method: "POST",
      credentials: "include",
    });
    setIsAuthenticated(false);
    setAdmin(null);
    window.location.assign("/vega/admin/login");
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        admin,
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
// File: src\hooks\useApi.ts
export async function apiGet<T = unknown>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) throw new Error(`GET ${url} failed: ${response.status}`);
  return response.json();
}

export async function apiPost<T = unknown>(
  url: string,
  body?: Record<string, unknown>
): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(`POST ${url} failed: ${response.status}`);
  return response.json();
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
}

html {
  scroll-behavior: smooth;
}

body {
  @apply bg-cream-50 text-night-800 dark:bg-night-900 dark:text-cream-100 transition-colors duration-300;
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

/* ── Card & Button Interactions ───────────────────── */

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
  .nav-link:hover {
    transform: none;
    box-shadow: none;
  }
  .btn-primary:active,
  .btn-outline:active,
  .nav-link:active {
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
  ADMINAPIADMINUSERS: `${API}/admin/api/admin-users`,
  ADMINAPITOTPSETUP: `${API}/admin/api/settings/totp/setup`,
  ADMINAPITOTPENABLE: `${API}/admin/api/settings/totp/enable`,
  ADMINAPITOTPDISABLE: `${API}/admin/api/settings/totp/disable`,
  ADMINAPICHANGEPASSWORD: `${API}/admin/api/settings/change-password`,
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
import { useEffect } from "react";
import { Outlet, useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  Inbox,
  Settings,
  Users,
  ScrollText,
  LogOut,
  Shield,
} from "lucide-react";

const navItems = [
  { to: "/vega/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/vega/admin/inbox", label: "Inbox", icon: Inbox },
  { to: "/vega/admin/settings", label: "Settings", icon: Settings },
  { to: "/vega/admin/admin-users", label: "Admin Users", icon: Users },
  { to: "/vega/admin/audit-logs", label: "Audit Logs", icon: ScrollText },
];

export default function AdminLayout() {
  const { isAuthenticated, isLoading, admin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/vega/admin/login", { replace: true });
    }
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex">
      <aside className="w-64 bg-card border-r flex flex-col">
        <div className="p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-semibold text-sm">Vega Admin</h1>
              <p className="text-xs text-muted-foreground">{admin?.username}</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const active = location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t">
          <button
            onClick={() => logout()}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted w-full"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
```

```tsx
// File: src\pages\admin\AdminUsers.tsx
import { useEffect, useState } from "react";
import { ROUTES } from "@/lib/routes";

interface AdminUser {
  id: string;
  username: string;
  email: string;
  display_name: string;
  role: string;
  status: string;
  totp_enabled: boolean;
  last_login_at: string;
  created_at: string;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(ROUTES.ADMINAPIADMINUSERS, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setUsers(data.items ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin Users</h1>
          <p className="text-muted-foreground text-sm">{users.length} admin accounts</p>
        </div>
      </div>

      <div className="rounded-xl bg-card border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
        ) : (
          <table className="w-full">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="text-left p-4 text-sm font-medium">Username</th>
                <th className="text-left p-4 text-sm font-medium">Display Name</th>
                <th className="text-left p-4 text-sm font-medium">Role</th>
                <th className="text-left p-4 text-sm font-medium">Status</th>
                <th className="text-left p-4 text-sm font-medium">TOTP</th>
                <th className="text-left p-4 text-sm font-medium">Last Login</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-muted/30">
                  <td className="p-4 text-sm font-medium">{u.username}</td>
                  <td className="p-4 text-sm">{u.display_name}</td>
                  <td className="p-4 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      u.role === "owner" ? "bg-purple-100 text-purple-700" :
                      u.role === "admin" ? "bg-blue-100 text-blue-700" :
                      "bg-slate-100 text-slate-700"
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="p-4 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      u.status === "active" ? "bg-green-100 text-green-700" :
                      "bg-red-100 text-red-700"
                    }`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="p-4 text-sm">{u.totp_enabled ? "Yes" : "No"}</td>
                  <td className="p-4 text-sm text-muted-foreground">
                    {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : "Never"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
```

```tsx
// File: src\pages\admin\AuditLogs.tsx
import { useEffect, useState } from "react";
import { ROUTES } from "@/lib/routes";

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
    fetch(`${ROUTES.ADMINAPIAUDITLOGS}?page=${page}&limit=50`, { credentials: "include" })
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

      <div className="rounded-xl bg-card border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
        ) : (
          <table className="w-full">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="text-left p-4 text-sm font-medium">Event</th>
                <th className="text-left p-4 text-sm font-medium">Actor</th>
                <th className="text-left p-4 text-sm font-medium">IP</th>
                <th className="text-left p-4 text-sm font-medium">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-muted/30">
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
            className="px-3 py-1 border rounded text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 border rounded text-sm disabled:opacity-50"
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
    fetch(ROUTES.ADMINAPISTATS, { credentials: "include" })
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
    fetch(`${ROUTES.ADMINAPIMESSAGES}?limit=5`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setRecent(data.items ?? []))
      .catch(() => {});
  }, []);

  const cards = [
    { label: "Total Messages", value: stats?.total_messages ?? 0, icon: MessageSquare, color: "text-blue-600" },
    { label: "New", value: stats?.new_messages ?? 0, icon: Mail, color: "text-orange-600" },
    { label: "In Progress", value: stats?.in_progress ?? 0, icon: Clock, color: "text-yellow-600" },
    { label: "Resolved", value: stats?.resolved ?? 0, icon: CheckCircle, color: "text-green-600" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Overview of your admin console</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl bg-card border p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-muted-foreground">{card.label}</span>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </div>
            <p className="text-3xl font-bold">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-card border">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="font-semibold">Recent Messages</h2>
          <Link to="/vega/admin/inbox" className="text-sm text-primary hover:underline flex items-center gap-1">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="divide-y">
          {recent.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No messages yet.</p>
          ) : (
            recent.map((msg) => (
              <Link
                key={msg.id}
                to={`/vega/admin/messages/${msg.id}`}
                className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
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
    fetch(`${ROUTES.ADMINAPIMESSAGES}?${params}`, { credentials: "include" })
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
            className="w-full pl-10 pr-4 py-2 border rounded-lg bg-background text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-4 py-2 border rounded-lg bg-background text-sm"
        >
          <option value="">All Statuses</option>
          <option value="new">New</option>
          <option value="in_progress">In Progress</option>
          <option value="waiting">Waiting</option>
          <option value="resolved">Resolved</option>
          <option value="spam">Spam</option>
        </select>
      </div>

      <div className="rounded-xl bg-card border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
        ) : messages.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No messages found.</div>
        ) : (
          <div className="divide-y">
            {messages.map((msg) => (
              <Link
                key={msg.id}
                to={`/vega/admin/messages/${msg.id}`}
                className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
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
            className="px-3 py-1 border rounded text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 border rounded text-sm disabled:opacity-50"
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
    fetch(`${ROUTES.ADMINAPIMESSAGES}/${id}`, { credentials: "include" })
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
    await fetch(`${ROUTES.ADMINAPIMESSAGES}/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    setMessage((prev) => prev ? { ...prev, [field]: value } : prev);
  }

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !noteBody.trim()) return;
    const res = await fetch(`${ROUTES.ADMINAPIMESSAGES}/${id}/notes`, {
      method: "POST",
      credentials: "include",
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
    await fetch(`${ROUTES.ADMINAPIMESSAGES}/${id}/tags`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tag_name: newTag }),
    });
    setNewTag("");
    const refreshed = await fetch(`${ROUTES.ADMINAPIMESSAGES}/${id}`, { credentials: "include" }).then((r) => r.json());
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
          <select value={status} onChange={(e) => { setStatus(e.target.value); updateField("status", e.target.value); }} className="px-3 py-1 border rounded-lg text-sm">
            <option value="new">New</option>
            <option value="in_progress">In Progress</option>
            <option value="waiting">Waiting</option>
            <option value="resolved">Resolved</option>
            <option value="spam">Spam</option>
          </select>
          <select value={priority} onChange={(e) => { setPriority(e.target.value); updateField("priority", e.target.value); }} className="px-3 py-1 border rounded-lg text-sm">
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
      </div>

      <div className="rounded-xl bg-card border p-6">
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.body}</p>
        <div className="mt-4 pt-4 border-t flex gap-4 text-xs text-muted-foreground">
          <span>Channel: {message.channel}</span>
          <span>Received: {new Date(message.created_at).toLocaleString()}</span>
          {message.sender_phone && <span>Phone: {message.sender_phone}</span>}
        </div>
      </div>

      <div className="rounded-xl bg-card border p-6">
        <h2 className="font-semibold mb-4 flex items-center gap-2"><Tag className="h-4 w-4" /> Tags</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          {message.tags.length === 0 && <span className="text-xs text-muted-foreground">No tags</span>}
          {message.tags.map((t) => (
            <span key={t.id} className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">{t.name}</span>
          ))}
        </div>
        <form onSubmit={addTag} className="flex gap-2">
          <input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="Add tag..." className="flex-1 px-3 py-1 border rounded-lg text-sm" />
          <button type="submit" className="px-3 py-1 bg-primary text-primary-foreground rounded-lg text-sm">Add</button>
        </form>
      </div>

      <div className="rounded-xl bg-card border p-6">
        <h2 className="font-semibold mb-4 flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Notes</h2>
        <div className="space-y-3 mb-4">
          {message.notes.length === 0 && <p className="text-xs text-muted-foreground">No notes yet</p>}
          {message.notes.map((n) => (
            <div key={n.id} className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm">{n.body}</p>
              <p className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</p>
            </div>
          ))}
        </div>
        <form onSubmit={addNote} className="flex gap-2">
          <input value={noteBody} onChange={(e) => setNoteBody(e.target.value)} placeholder="Add a note..." className="flex-1 px-3 py-1 border rounded-lg text-sm" />
          <button type="submit" className="px-3 py-1 bg-primary text-primary-foreground rounded-lg text-sm flex items-center gap-1">
            <Send className="h-3 w-3" /> Add
          </button>
        </form>
      </div>
    </div>
  );
}
```

```tsx
// File: src\pages\admin\Settings.tsx
import { useEffect, useState } from "react";
import { ROUTES } from "@/lib/routes";
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
    fetch(ROUTES.ADMINAPISETTINGS, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setTotpEnabled(data.totp_enabled))
      .catch(() => {});
  }, []);

  async function startTotpSetup() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(ROUTES.ADMINAPITOTPSETUP, { credentials: "include" });
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
      const res = await fetch(ROUTES.ADMINAPITOTPENABLE, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: totpCode, secret: totpSecret }),
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
      const res = await fetch(ROUTES.ADMINAPITOTPDISABLE, {
        method: "POST",
        credentials: "include",
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
    setLoading(true);
    setError("");
    try {
      const res = await fetch(ROUTES.ADMINAPICHANGEPASSWORD, {
        method: "POST",
        credentials: "include",
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

      {msg && <div className="p-3 bg-green-50 border border-green-200 text-green-800 rounded-lg text-sm">{msg}</div>}
      {error && <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm">{error}</div>}

      <div className="rounded-xl bg-card border p-6">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="h-5 w-5 text-primary" />
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
                  className="px-3 py-1 border rounded-lg text-sm font-mono w-32"
                  maxLength={6}
                />
                <button type="submit" disabled={loading} className="px-4 py-1 bg-red-600 text-white rounded-lg text-sm">
                  Disable
                </button>
              </form>
            </div>
          ) : (
            <button onClick={startTotpSetup} disabled={loading} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm">
              Enable TOTP
            </button>
          )
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground mb-2">Add this secret to your authenticator app:</p>
              <code className="text-sm font-mono break-all">{totpSecret}</code>
            </div>
            <form onSubmit={enableTotp} className="flex gap-2">
              <input
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="px-3 py-1 border rounded-lg text-sm font-mono w-32"
                maxLength={6}
              />
              <button type="submit" disabled={loading} className="px-4 py-1 bg-primary text-primary-foreground rounded-lg text-sm">
                Verify & Enable
              </button>
            </form>
          </div>
        )}
      </div>

      <div className="rounded-xl bg-card border p-6">
        <div className="flex items-center gap-3 mb-4">
          <Lock className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Change Password</h2>
        </div>
        <form onSubmit={changePassword} className="space-y-3">
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current password"
            className="w-full px-3 py-2 border rounded-lg text-sm"
            required
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password"
            className="w-full px-3 py-2 border rounded-lg text-sm"
            required
            minLength={6}
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            className="w-full px-3 py-2 border rounded-lg text-sm"
            required
          />
          <button type="submit" disabled={loading} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm">
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
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/lib/routes";
import { Shield } from "lucide-react";

export default function Setup() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    username: "",
    password: "",
    confirmPassword: "",
    email: "",
    display_name: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(ROUTES.ADMINAPISETUPCREATE, {
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
              minLength={6}
            />
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
// File: src\pages\AdminLogin.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, OtpCooldownError } from "@/contexts/AuthContext";
import { ROUTES } from "@/lib/routes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Eye,
  EyeOff,
  Shield,
  AlertTriangle,
  ArrowLeft,
  KeyRound,
  Lock,
  Fingerprint,
  Send,
} from "lucide-react";

type OtpMethod = "telegram" | "totp";

function formatCountdown(s: number) {
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const { login, loginTotp, loginOtpSend, loginOtpVerify } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [methods, setMethods] = useState<string[]>([]);
  const [method, setMethod] = useState<OtpMethod>("telegram");
  const [code, setCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpMsg, setOtpMsg] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const [showForgotDialog, setShowForgotDialog] = useState(false);
  const [forgotStep, setForgotStep] = useState<"verify" | "reset">("verify");
  const [forgotChallengeId, setForgotChallengeId] = useState<string | null>(null);
  const [forgotData, setForgotData] = useState({
    username: "",
    totpToken: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);

  useEffect(() => {
    fetch(ROUTES.ADMINAPISETUPREQUIRED, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.required) {
          setSetupRequired(true);
          navigate("/vega/admin/setup", { replace: true });
        }
      })
      .catch(() => {});
  }, [navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const useTelegram = method === "telegram" && methods.includes("telegram_otp");

  function resetSecondFactor() {
    setChallengeId(null);
    setMethods([]);
    setMethod("telegram");
    setCode("");
    setOtpSent(false);
    setOtpMsg(null);
    setCooldown(0);
    setError("");
  }

  async function handleSendOtp() {
    if (!challengeId) return;
    setError("");
    setSending(true);
    setOtpMsg(null);
    try {
      const res = await loginOtpSend(challengeId);
      setOtpSent(true);
      setOtpMsg("Code sent to your Telegram. Check your chat and enter the code below.");
      setCooldown(res.cooldown_seconds ?? 60);
    } catch (err) {
      if (err instanceof OtpCooldownError) {
        setOtpSent(true);
        setCooldown(err.cooldownSeconds);
      } else {
        setError(err instanceof Error ? err.message : "Failed to send code");
      }
    } finally {
      setSending(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await login(username, password, rememberMe);
      if (result.status === "second_factor_required") {
        setChallengeId(result.challenge_id);
        const m = result.methods ?? [];
        setMethods(m);
        if (m.includes("telegram_otp")) {
          setMethod("telegram");
        } else if (m.includes("totp")) {
          setMethod("totp");
        }
        if (m.includes("telegram_otp")) {
          setTimeout(() => handleSendOtpWithChallenge(result.challenge_id), 100);
        }
      } else {
        navigate("/vega/admin/dashboard", { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendOtpWithChallenge(cid: string) {
    try {
      const res = await loginOtpSend(cid);
      setOtpSent(true);
      setOtpMsg("Code sent to your Telegram. Check your chat and enter the code below.");
      setCooldown(res.cooldown_seconds ?? 60);
    } catch (err) {
      if (err instanceof OtpCooldownError) {
        setOtpSent(true);
        setCooldown(err.cooldownSeconds);
      } else {
        setError(err instanceof Error ? err.message : "Failed to send code");
      }
    }
  }

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!challengeId) return;
    setError("");
    setLoading(true);
    try {
      if (useTelegram) {
        const result = await loginOtpVerify(challengeId, code);
        if (result.totpRequired && result.challenge_id) {
          setChallengeId(result.challenge_id);
          setMethod("totp");
          setCode("");
          setOtpSent(false);
          setOtpMsg(null);
          return;
        }
      } else {
        await loginTotp(challengeId, code);
      }
      navigate("/vega/admin/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (forgotStep === "verify") {
        const response = await fetch(ROUTES.ADMINAPIPASSWORDFORGOTVERIFY, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: forgotData.username,
            totp_code: forgotData.totpToken,
          }),
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({ detail: "Verification failed" }));
          throw new Error(typeof err.detail === "string" ? err.detail : "Verification failed");
        }
        const data = await response.json();
        setForgotChallengeId(data.challenge_id);
        setForgotStep("reset");
        setSuccess("TOTP verified. Enter your new password.");
      } else {
        if (forgotData.newPassword !== forgotData.confirmPassword) {
          setError("Passwords do not match");
          setLoading(false);
          return;
        }
        if (forgotData.newPassword.length < 6) {
          setError("Password must be at least 6 characters");
          setLoading(false);
          return;
        }
        const response = await fetch(ROUTES.ADMINAPIPASSWORDFORGOTRESET, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            challenge_id: forgotChallengeId,
            new_password: forgotData.newPassword,
          }),
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({ detail: "Reset failed" }));
          throw new Error(typeof err.detail === "string" ? err.detail : "Reset failed");
        }
        setSuccess("Password reset successfully! Redirecting to login...");
        setTimeout(() => {
          setShowForgotDialog(false);
          setForgotStep("verify");
          setForgotChallengeId(null);
          setForgotData({ username: "", totpToken: "", newPassword: "", confirmPassword: "" });
          setSuccess("");
        }, 2000);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Operation failed");
    } finally {
      setLoading(false);
    }
  }

  if (setupRequired) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-[auto]">
        <div className="md:col-span-1 md:row-span-2 rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/10 p-8 flex flex-col items-center justify-center text-center gap-4">
          <div className="p-4 bg-primary/15 rounded-2xl">
            <Shield className="h-12 w-12 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Vega Admin</h1>
            <p className="text-muted-foreground text-sm mt-1">Secure management console</p>
          </div>
          <div className="mt-4 space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-3">
              <Lock className="h-4 w-4 text-primary shrink-0" />
              <span>End-to-end encrypted auth</span>
            </div>
            <div className="flex items-center gap-3">
              <Fingerprint className="h-4 w-4 text-primary shrink-0" />
              <span>Two-factor protection</span>
            </div>
            <div className="flex items-center gap-3">
              <Shield className="h-4 w-4 text-primary shrink-0" />
              <span>Session-based access control</span>
            </div>
          </div>
        </div>

        <div className="md:col-span-2 rounded-2xl bg-card border shadow-sm p-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold">
              {challengeId ? "Two-Factor Authentication" : "Sign in to your account"}
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              {challengeId ? "Verify your identity to continue" : "Enter your credentials to continue"}
            </p>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {otpMsg && (
            <Alert className="mb-4 bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
              <Send className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800 dark:text-blue-200">{otpMsg}</AlertDescription>
            </Alert>
          )}

          {!challengeId ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    placeholder="Enter username"
                    value={username}
                    onChange={(e) => { setUsername(e.target.value); setError(""); }}
                    required
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter password"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setError(""); }}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center space-x-2 text-sm">
                  <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="rounded border-gray-300" />
                  <span>Remember me</span>
                </label>
                <button
                  type="button"
                  onClick={() => { setShowForgotDialog(true); setForgotStep("verify"); setError(""); setSuccess(""); }}
                  className="text-sm text-primary hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Please wait..." : "Login"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleCodeSubmit} className="space-y-4">
              {methods.length > 1 && (
                <div className="flex gap-2 p-1 bg-muted rounded-lg">
                  {methods.includes("telegram_otp") && (
                    <button
                      type="button"
                      onClick={() => { setMethod("telegram"); setCode(""); setOtpSent(false); setOtpMsg(null); }}
                      className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                        method === "telegram" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Send className="h-4 w-4 inline-block mr-1.5" />
                      Telegram OTP
                    </button>
                  )}
                  {methods.includes("totp") && (
                    <button
                      type="button"
                      onClick={() => { setMethod("totp"); setCode(""); setOtpSent(false); setOtpMsg(null); }}
                      className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                        method === "totp" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <KeyRound className="h-4 w-4 inline-block mr-1.5" />
                      Authenticator
                    </button>
                  )}
                </div>
              )}

              {useTelegram ? (
                <>
                  {!otpSent ? (
                    <Button type="button" variant="outline" className="w-full" onClick={handleSendOtp} disabled={sending}>
                      <Send className="h-4 w-4 mr-2" />
                      {sending ? "Sending..." : "Send code via Telegram"}
                    </Button>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="otp-code" className="flex items-center gap-2">
                          <Send className="h-4 w-4" />
                          Telegram Code
                        </Label>
                        <Input
                          id="otp-code"
                          placeholder="000000"
                          value={code}
                          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          required
                          maxLength={6}
                          pattern="\d{6}"
                          className="font-mono text-lg tracking-widest max-w-xs text-center"
                          autoFocus
                        />
                      </div>
                      {cooldown > 0 ? (
                        <p className="text-sm text-muted-foreground text-center">Resend available in {formatCountdown(cooldown)}</p>
                      ) : (
                        <Button type="button" variant="ghost" className="w-full" onClick={handleSendOtp}>
                          <Send className="h-4 w-4 mr-2" />
                          Resend OTP
                        </Button>
                      )}
                    </>
                  )}
                </>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="totp-code" className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4" />
                    Authenticator Code
                  </Label>
                  <Input
                    id="totp-code"
                    placeholder="000000"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    required
                    maxLength={6}
                    pattern="\d{6}"
                    className="font-mono text-lg tracking-widest max-w-xs text-center"
                    autoFocus
                  />
                </div>
              )}

              {!(useTelegram && !otpSent) && (
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Verifying..." : "Verify"}
                </Button>
              )}

              <Button type="button" variant="ghost" className="w-full" onClick={resetSecondFactor}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to login
              </Button>
            </form>
          )}
        </div>

        <div className="md:col-span-1 rounded-2xl bg-card border shadow-sm p-6 flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm font-medium">System Online</span>
          </div>
          <p className="text-xs text-muted-foreground">All services operational. Session timeout: 30 minutes.</p>
        </div>
      </div>

      <Dialog open={showForgotDialog} onOpenChange={setShowForgotDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              {forgotStep === "verify"
                ? "Enter your username and TOTP code to verify your identity."
                : "Create a new password for your account."}
            </DialogDescription>
          </DialogHeader>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert className="mb-4 bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
              <AlertDescription className="text-green-800 dark:text-green-200">{success}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="forgot-username">Username</Label>
              <Input
                id="forgot-username"
                placeholder="Enter your username"
                value={forgotData.username}
                onChange={(e) => setForgotData({ ...forgotData, username: e.target.value })}
                required
                disabled={forgotStep === "reset"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="forgot-totp" className="flex items-center gap-2">
                <KeyRound className="h-4 w-4" />
                TOTP Code
              </Label>
              <Input
                id="forgot-totp"
                placeholder="6-digit code from authenticator"
                value={forgotData.totpToken}
                onChange={(e) => setForgotData({ ...forgotData, totpToken: e.target.value })}
                required
                maxLength={6}
                pattern="\d{6}"
                className="font-mono tracking-widest"
                disabled={forgotStep === "reset"}
              />
            </div>
            {forgotStep === "reset" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showNewPassword ? "text" : "password"}
                      placeholder="Minimum 6 characters"
                      value={forgotData.newPassword}
                      onChange={(e) => setForgotData({ ...forgotData, newPassword: e.target.value })}
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Confirm your new password"
                    value={forgotData.confirmPassword}
                    onChange={(e) => setForgotData({ ...forgotData, confirmPassword: e.target.value })}
                    required
                  />
                </div>
              </>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Please wait..." : forgotStep === "verify" ? "Verify TOTP" : "Reset Password"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
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
  },
});
```
