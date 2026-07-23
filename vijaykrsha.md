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

```json
// File: public\logo\logo.json
{
  "src": "/logo/logo.png.gz",
  "fps": 10,
  "frames": 15,
  "frameWidth": 200,
  "frameHeight": 200,
  "scale": 0.30,
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
    scale: size ? size / logoConfig.frameWidth : logoConfig.scale,
    blendMode: logoConfig.blendMode as GlobalCompositeOperation,
  };

  useSpriteAnimation(canvasRef, config);

  const displaySize = config.frameWidth * config.scale;

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

```typescript
// File: src\config\site.ts
export const site = {
  name: "Vijay Kumar Sharma",
  tagline: "Legal Research, Drafting & Digital Legal Solutions",
  description:
    "Law graduate (LL.B.), legal researcher, and contract drafting professional with experience supporting individuals, businesses, and startups through practical legal documentation, research, and technology-assisted solutions. Based in India.",

  contact: {
    phone: "+91-9599130381",
    email: "vijaykrsha@hotmail.com",
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
    availability: "Monday - Saturday, 9 AM - 7 PM IST",
    responseTime: "Within 24 hours",
    communication: "Email, Phone, Video Call",
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
      status: "coming-soon" as const,
      description:
        "WiFi-based file transfer app for Android. Share files from your phone to any device on the same network using just a browser — no app installation needed on the receiving end.",
      features: [
        "Transfer files over same WiFi network via any browser",
        "Preview documents, images, video, and audio directly in the browser",
        "Upload files from any device back to your phone via browser URL",
        "No app installation required on the receiving device",
      ],
      techStack: ["Android", "Kotlin", "HTTP Server", "WebSocket"],
      link: { label: "Coming Soon", url: "#" },
      tags: ["Android", "WiFi", "File Transfer", "Browser"],
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

```typescript
// File: src\hooks\useSpriteAnimation.ts
import { useEffect, useRef, useCallback } from "react";

interface SpriteConfig {
  src: string;
  fps: number;
  frames: number;
  frameWidth: number;
  frameHeight: number;
  scale: number;
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
      const { frameWidth, frameHeight, scale, opacity, blendMode } = config;
      const dw = frameWidth * scale;
      const dh = frameHeight * scale;

      ctx.clearRect(0, 0, dw, dh);
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
        dw,
        dh
      );
    },
    [config]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { frameWidth, frameHeight, scale, frames, fps, loop } = config;
    const dw = frameWidth * scale;
    const dh = frameHeight * scale;

    canvas.width = dw;
    canvas.height = dh;

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
  image-rendering: -webkit-optimize-contrast;
  image-rendering: crisp-edges;
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
                <Icon />
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

              {/* Screenshot Placeholder */}
              <div className="h-36 rounded-xl bg-cream-200 dark:bg-night-700 flex items-center justify-center mb-4 border border-cream-300 dark:border-night-600">
                <span className="text-xs text-night-800/30 dark:text-cream-100/30">
                  Screenshot coming soon
                </span>
              </div>

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
                target={app.link.url !== "#" ? "_blank" : undefined}
                rel={app.link.url !== "#" ? "noopener noreferrer" : undefined}
                className={`inline-block text-center px-5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  app.link.url !== "#"
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

export default function Contact() {
  const { contact, workingStyle, beforeContacting } = site;
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
              href={`tel:${contact.phone}`}
              className="card-hover flex items-center gap-3 p-5 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700 hover:border-glow-500 transition-colors"
            >
              <PhoneIcon />
              <div>
                <p className="text-xs text-night-800/50 dark:text-cream-100/50">Phone</p>
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
            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-night-800/60 dark:text-cream-100/60 mb-1.5">
                    Name
                  </label>
                  <input
                    type="text"
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
                    className="w-full px-4 py-2.5 rounded-xl bg-cream-50 dark:bg-night-900 border border-cream-200 dark:border-night-600 text-sm text-night-800 dark:text-cream-100 focus:outline-none focus:border-glow-500 transition-colors"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-night-800/60 dark:text-cream-100/60 mb-1.5">
                    Project Type
                  </label>
                  <select className="w-full px-4 py-2.5 rounded-xl bg-cream-50 dark:bg-night-900 border border-cream-200 dark:border-night-600 text-sm text-night-800 dark:text-cream-100 focus:outline-none focus:border-glow-500 transition-colors">
                    <option>Legal Research</option>
                    <option>Contract Drafting</option>
                    <option>Data Analysis</option>
                    <option>Legal-Tech Integration</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-night-800/60 dark:text-cream-100/60 mb-1.5">
                    Budget Range
                  </label>
                  <select className="w-full px-4 py-2.5 rounded-xl bg-cream-50 dark:bg-night-900 border border-cream-200 dark:border-night-600 text-sm text-night-800 dark:text-cream-100 focus:outline-none focus:border-glow-500 transition-colors">
                    <option>Under ₹10,000</option>
                    <option>₹10,000 - ₹50,000</option>
                    <option>₹50,000 - ₹1,00,000</option>
                    <option>₹1,00,000+</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-night-800/60 dark:text-cream-100/60 mb-1.5">
                  Priority
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm text-night-800 dark:text-cream-100 cursor-pointer">
                    <input type="radio" name="priority" value="standard" defaultChecked className="accent-glow-500" />
                    Standard
                  </label>
                  <label className="flex items-center gap-2 text-sm text-night-800 dark:text-cream-100 cursor-pointer">
                    <input type="radio" name="priority" value="urgent" className="accent-glow-500" />
                    Urgent
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-night-800/60 dark:text-cream-100/60 mb-1.5">
                  Message
                </label>
                <textarea
                  rows={4}
                  className="w-full px-4 py-2.5 rounded-xl bg-cream-50 dark:bg-night-900 border border-cream-200 dark:border-night-600 text-sm text-night-800 dark:text-cream-100 focus:outline-none focus:border-glow-500 transition-colors resize-none"
                  placeholder="Tell me about your project..."
                />
              </div>

              <button
                type="submit"
                className="btn-primary px-6 py-2.5 rounded-xl bg-glow-500 text-white font-medium text-sm hover:bg-glow-600"
              >
                Send Message
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
