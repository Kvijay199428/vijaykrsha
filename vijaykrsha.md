```yaml
// File: docker-compose.yml
services:
  web:
    build: .
    ports:
      - "8080:80"
    restart: unless-stopped
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
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "react-router-dom": "^7.6.1"
  },
  "devDependencies": {
    "@types/react": "^19.1.8",
    "@types/react-dom": "^19.1.6",
    "@vitejs/plugin-react": "^4.5.2",
    "tailwindcss": "^4.1.7",
    "@tailwindcss/vite": "^4.1.7",
    "typescript": "~5.8.3",
    "vite": "^6.3.5"
  }
}
```

```xml
// File: public\favicon.svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="#a78bfa"/>
  <text x="16" y="23" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-weight="700" font-size="20" fill="#fff">V</text>
</svg>
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

export default function App() {
  return (
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
  );
}
```

```tsx
// File: src\components\Layout.tsx
import { Link, useLocation } from "react-router-dom";
import { useTheme } from "@/context/ThemeContext";
import { site } from "@/config/site";

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

import { useState } from "react";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 bg-cream-50/80 dark:bg-night-900/80 backdrop-blur-md border-b border-cream-200 dark:border-night-700">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="font-bold text-lg text-glow-600 dark:text-glow-400">
            {site.name.split(" ")[0]}
            <span className="text-night-800 dark:text-cream-100">
              {site.name.slice(site.name.indexOf(" ") + 1)}
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            {site.nav.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`text-sm font-medium transition-colors ${
                  location.pathname === item.path
                    ? "text-glow-600 dark:text-glow-400"
                    : "text-night-800/70 dark:text-cream-100/70 hover:text-night-800 dark:hover:text-cream-100"
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
                className={`block py-3 text-sm font-medium transition-colors ${
                  location.pathname === item.path
                    ? "text-glow-600 dark:text-glow-400"
                    : "text-night-800/70 dark:text-cream-100/70"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-cream-200 dark:border-night-700 bg-cream-100 dark:bg-night-800">
        <div className="max-w-6xl mx-auto px-4 py-8 text-center text-sm text-night-800/60 dark:text-cream-100/60">
          <p>&copy; {new Date().getFullYear()} {site.name}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
```

```typescript
// File: src\config\site.ts
export const site = {
  name: "Vijay Kumar Sharma",
  tagline: "Legal & Tech Freelancer",
  description:
    "Legal researcher, contract drafter, and data analyst offering freelance services in law and technology. Based in India.",

  contact: {
    phone: "+91-9599130381",
    email: "vijay@vijaykrsha.online",
    emailAlt: "contact@vijaykrsha.online",
    website: "https://vijaykrsha.online",
    location: "India",
  },

  nav: [
    { label: "Home", path: "/" },
    { label: "About", path: "/about" },
    { label: "Freelance", path: "/freelance" },
    { label: "Portfolio", path: "/portfolio" },
    { label: "Apps", path: "/apps" },
    { label: "Contact", path: "/contact" },
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
      title: "Confidentiality",
      description:
        "NDA-first approach. Every engagement starts with a non-disclosure agreement.",
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
    },
    {
      title: "Contract Drafting",
      description:
        "Professional contract drafting, review, and negotiation support for businesses and individuals.",
      icon: "document",
    },
    {
      title: "Data & Excel Dashboards",
      description:
        "Interactive dashboards, data visualization, and spreadsheet automation for smarter decisions.",
      icon: "chart",
    },
    {
      title: "Legal-Tech Integration",
      description:
        "Bridging law and technology — workflow automation, document management, and tech solutions for legal practice.",
      icon: "gear",
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
      title: "3+ Years Experience",
      description:
        "Proven track record across legal research, contract management, and data analytics projects.",
    },
  ],

  projects: [
    {
      title: "Multi-State Compliance Dashboard",
      category: "Legal",
      description:
        "Built a compliance tracking dashboard for a mid-size firm monitoring obligations across 8 Indian states.",
      tags: ["Compliance", "Excel", "Legal Research"],
    },
    {
      title: "Contract Analytics Platform",
      category: "Tech",
      description:
        "Developed an automated contract review tool that reduced clause analysis time by 60%.",
      tags: ["NLP", "Python", "Legal-Tech"],
    },
    {
      title: "Regulatory Impact Assessment",
      category: "Legal",
      description:
        "Conducted a comprehensive regulatory impact assessment for a fintech client entering the Indian market.",
      tags: ["Fintech", "Regulation", "Research"],
    },
    {
      title: "Legal Operations Automation",
      category: "Tech",
      description:
        "Automated document generation and case tracking workflows for a legal department, saving 20+ hours weekly.",
      tags: ["Automation", "Workflow", "Productivity"],
    },
  ],

  apps: [
    {
      title: "Vega Share",
      category: "Android",
      icon: "share",
      description:
        "WiFi-based file transfer app for Android. Share files from your phone to any device on the same network using just a browser — no app installation needed on the receiving end.",
      features: [
        "Transfer files over same WiFi network via any browser",
        "Preview documents, images, video, and audio directly in the browser",
        "Upload files from any device back to your phone via browser URL",
        "No app installation required on the receiving device",
      ],
      link: { label: "Coming Soon", url: "#" },
      tags: ["Android", "WiFi", "File Transfer", "Browser"],
    },
    {
      title: "Rent App Management",
      category: "Web",
      icon: "building",
      description:
        "Web app for landlords to manage tenant-landlord rent transactions. Track monthly rent status, view lifetime earnings, and get a clear financial overview at a glance.",
      features: [
        "Track monthly rent payments — paid, unpaid, or partial",
        "Lifetime earnings dashboard for landlords",
        "Tenant management with full payment history",
        "Clean dashboard for quick financial overview",
      ],
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
```

```tsx
// File: src\main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "@/context/ThemeContext";
import App from "@/App";
import "@/index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
);
```

```tsx
// File: src\pages\About.tsx
import { site } from "@/config/site";

export default function About() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-20">
      <h1 className="text-3xl md:text-4xl font-bold text-night-800 dark:text-cream-50 mb-4">
        About Me
      </h1>
      <p className="text-night-800/70 dark:text-cream-100/70 max-w-2xl mb-12">
        Combining legal expertise with technology to deliver precise, efficient, and
        confidential freelance solutions.
      </p>

      <section className="mb-16">
        <h2 className="text-xl font-semibold text-night-800 dark:text-cream-50 mb-6">
          Qualifications
        </h2>
        <div className="grid sm:grid-cols-2 gap-6">
          {site.qualifications.map((q) => (
            <div
              key={q.degree}
              className="p-6 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700"
            >
              <p className="text-sm text-glow-500 font-medium mb-1">{q.degree}</p>
              <p className="text-night-800/70 dark:text-cream-100/70 text-sm">{q.institution}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-night-800 dark:text-cream-50 mb-6">
          Areas of Expertise
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {site.expertise.map((e) => (
            <div
              key={e}
              className="flex items-center gap-3 p-4 rounded-xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700"
            >
              <span className="h-2 w-2 rounded-full bg-glow-500 shrink-0" />
              <span className="text-sm text-night-800 dark:text-cream-100">{e}</span>
            </div>
          ))}
        </div>
      </section>
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
        tools.
      </p>

      <div className="grid sm:grid-cols-2 gap-6">
        {site.apps.map((app) => {
          const Icon = iconMap[app.icon ?? ""] ?? ShareIcon;
          return (
            <div
              key={app.title}
              className="p-6 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700 flex flex-col"
            >
              <div className="flex items-center gap-3 mb-3">
                <Icon />
                <span
                  className={`h-2 w-2 rounded-full ${categoryColors[app.category] ?? "bg-glow-500"}`}
                />
                <span className="text-xs font-medium text-night-800/50 dark:text-cream-100/50 uppercase tracking-wide">
                  {app.category}
                </span>
              </div>

              <h3 className="font-semibold text-night-800 dark:text-cream-50 mb-2">
                {app.title}
              </h3>
              <p className="text-sm text-night-800/60 dark:text-cream-100/60 mb-4">
                {app.description}
              </p>

              <ul className="text-sm text-night-800/60 dark:text-cream-100/60 mb-4 space-y-1.5 flex-1">
                {app.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1 w-1 rounded-full bg-glow-500 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

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

              <a
                href={app.link.url}
                target={app.link.url !== "#" ? "_blank" : undefined}
                rel={app.link.url !== "#" ? "noopener noreferrer" : undefined}
                className={`inline-block text-center px-5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  app.link.url !== "#"
                    ? "bg-glow-500 text-white hover:bg-glow-600"
                    : "border border-cream-300 dark:border-night-600 text-night-800/70 dark:text-cream-100/70 hover:bg-cream-200 dark:hover:bg-night-700"
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

export default function Contact() {
  const { contact } = site;
  return (
    <div className="max-w-6xl mx-auto px-4 py-20">
      <h1 className="text-3xl md:text-4xl font-bold text-night-800 dark:text-cream-50 mb-4">
        Contact
      </h1>
      <p className="text-night-800/70 dark:text-cream-100/70 max-w-2xl mb-12">
        Ready to start a project? Reach out through any of the channels below.
      </p>

      <div className="grid sm:grid-cols-2 gap-6 max-w-xl">
        <a
          href={`tel:${contact.phone}`}
          className="flex items-center gap-3 p-5 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700 hover:border-glow-500 transition-colors"
        >
          <PhoneIcon />
          <div>
            <p className="text-xs text-night-800/50 dark:text-cream-100/50">Phone</p>
            <p className="text-sm font-medium text-night-800 dark:text-cream-50">{contact.phone}</p>
          </div>
        </a>

        <a
          href={`mailto:${contact.email}`}
          className="flex items-center gap-3 p-5 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700 hover:border-glow-500 transition-colors"
        >
          <MailIcon />
          <div>
            <p className="text-xs text-night-800/50 dark:text-cream-100/50">Email</p>
            <p className="text-sm font-medium text-night-800 dark:text-cream-50">{contact.email}</p>
          </div>
        </a>

        <a
          href={`mailto:${contact.emailAlt}`}
          className="flex items-center gap-3 p-5 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700 hover:border-glow-500 transition-colors"
        >
          <MailIcon />
          <div>
            <p className="text-xs text-night-800/50 dark:text-cream-100/50">Alt Email</p>
            <p className="text-sm font-medium text-night-800 dark:text-cream-50">{contact.emailAlt}</p>
          </div>
        </a>

        <a
          href={contact.website}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-5 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700 hover:border-glow-500 transition-colors"
        >
          <GlobeIcon />
          <div>
            <p className="text-xs text-night-800/50 dark:text-cream-100/50">Website</p>
            <p className="text-sm font-medium text-night-800 dark:text-cream-50">{contact.website}</p>
          </div>
        </a>

        <div className="flex items-center gap-3 p-5 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700 sm:col-span-2">
          <MapPinIcon />
          <div>
            <p className="text-xs text-night-800/50 dark:text-cream-100/50">Location</p>
            <p className="text-sm font-medium text-night-800 dark:text-cream-50">{contact.location}</p>
          </div>
        </div>
      </div>

      <div className="mt-10 p-5 rounded-2xl bg-glow-500/10 border border-glow-500/30 max-w-xl">
        <p className="text-sm text-night-800 dark:text-cream-100">
          <strong className="text-glow-600 dark:text-glow-400">Confidentiality guaranteed.</strong>{" "}
          All communications and project details are handled under strict NDA. Your privacy is paramount.
        </p>
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
        Professional legal and tech services tailored to your needs.
      </p>

      <section className="mb-16">
        <div className="grid sm:grid-cols-2 gap-6">
          {site.services.map((s) => {
            const Icon = iconMap[s.icon] ?? ScaleIcon;
            return (
              <div
                key={s.title}
                className="p-6 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700"
              >
                <Icon />
                <h3 className="mt-4 font-semibold text-night-800 dark:text-cream-50">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm text-night-800/60 dark:text-cream-100/60">
                  {s.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-night-800 dark:text-cream-50 mb-6">
          Working Principles
        </h2>
        <div className="grid sm:grid-cols-3 gap-6">
          {site.principles.map((p) => (
            <div
              key={p.title}
              className="p-5 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700"
            >
              <h3 className="font-semibold text-glow-500 mb-2">{p.title}</h3>
              <p className="text-sm text-night-800/60 dark:text-cream-100/60">
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

function ScaleIcon() {
  return (
    <svg className="h-8 w-8 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.589-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.589-1.202L5.25 4.971z" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg className="h-8 w-8 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg className="h-8 w-8 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

const iconMap = { scale: ScaleIcon, chart: ChartIcon, shield: ShieldIcon };

export default function Home() {
  return (
    <div>
      <section className="max-w-6xl mx-auto px-4 py-20 md:py-32 text-center">
        <p className="text-sm font-medium text-glow-500 mb-4 tracking-wide uppercase">
          {site.tagline}
        </p>
        <h1 className="text-4xl md:text-6xl font-bold text-night-800 dark:text-cream-50 mb-6">
          {site.name}
        </h1>
        <p className="text-lg text-night-800/70 dark:text-cream-100/70 max-w-2xl mx-auto mb-10">
          {site.description}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/freelance"
            className="inline-block px-6 py-3 rounded-xl bg-glow-500 text-white font-medium hover:bg-glow-600 transition-colors"
          >
            View Services
          </Link>
          <Link
            to="/contact"
            className="inline-block px-6 py-3 rounded-xl border border-cream-300 dark:border-night-600 font-medium hover:bg-cream-200 dark:hover:bg-night-700 transition-colors"
          >
            Get in Touch
          </Link>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 pb-20">
        <div className="grid md:grid-cols-3 gap-6">
          {site.highlights.map((h) => {
            const Icon = iconMap[h.icon as keyof typeof iconMap];
            return (
              <div
                key={h.title}
                className="p-6 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700"
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

export default function Portfolio() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-20">
      <h1 className="text-3xl md:text-4xl font-bold text-night-800 dark:text-cream-50 mb-4">
        Portfolio
      </h1>
      <p className="text-night-800/70 dark:text-cream-100/70 max-w-2xl mb-12">
        Selected projects across legal research and technology.
      </p>

      <div className="grid sm:grid-cols-2 gap-6">
        {site.projects.map((p) => (
          <div
            key={p.title}
            className="p-6 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700 flex flex-col"
          >
            <div className="flex items-center gap-2 mb-3">
              <span
                className={`h-2 w-2 rounded-full ${categoryColors[p.category] ?? "bg-glow-500"}`}
              />
              <span className="text-xs font-medium text-night-800/50 dark:text-cream-100/50 uppercase tracking-wide">
                {p.category}
              </span>
            </div>
            <h3 className="font-semibold text-night-800 dark:text-cream-50 mb-2">
              {p.title}
            </h3>
            <p className="text-sm text-night-800/60 dark:text-cream-100/60 mb-4 flex-1">
              {p.description}
            </p>
            <div className="flex flex-wrap gap-2">
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
  base: "./",
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
