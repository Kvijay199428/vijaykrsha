I've generated the complete \*\*vijaykrsha-website\*\* project — a Vite + React + TypeScript + Tailwind CSS v4 application with Docker and Cloudflare Pages/Tunnel support. All 30 files are ready to download. Here's the full breakdown:



\## Project Architecture







\## Complete File Tree



```

vijaykrsha-website/

├── .cloudflare/

│   ├── config.yml              # Cloudflare Tunnel ingress rules

│   └── pages.toml              # Pages project settings

├── public/

│   └── favicon.svg             # SVG favicon (purple "V" badge)

├── src/

│   ├── components/

│   │   └── Layout.tsx          # Header + nav + footer + theme toggle

│   ├── config/

│   │   └── site.ts             # Single source of truth (name, contact, nav)

│   ├── context/

│   │   └── ThemeContext.tsx    # Dark/light context provider

│   ├── pages/

│   │   ├── Home.tsx            # Hero + highlight cards

│   │   ├── About.tsx           # Qualifications + expertise

│   │   ├── Freelance.tsx       # Services + working principles

│   │   ├── Portfolio.tsx        # Project showcase

│   │   ├── Contact.tsx          # Phone, emails, website, location

│   │   └── NotFound.tsx         # 404 fallback

│   ├── App.tsx                 # Router setup

│   ├── main.tsx                # Entry point

│   ├── index.css               # Tailwind v4 + soft color palette

│   └── vite-env.d.ts

├── Dockerfile                  # Multi-stage build (Node → Nginx)

├── docker-compose.yml          # One-command container run

├── nginx.conf                  # SPA fallback + gzip + cache headers

├── wrangler.toml               # Cloudflare Workers/Pages config

├── vite.config.ts              # base: "./" + Tailwind plugin + HMR

├── tsconfig.json               # Strict TS config with @/\* path alias

├── package.json                # React 19, Vite 6, Tailwind v4, Router v7

├── .env.example                # Site config template

├── .dockerignore

├── .gitignore

└── README.md                   # Full setup + deploy instructions

```



\## Key Design Decisions



\### Vite Config for Cloudflare + Docker



```typescript

// vite.config.ts

export default defineConfig({

&#x20; base: "./",                          // relative paths → works on any domain

&#x20; plugins: \[react(), tailwindcss()],   // Tailwind v4 Vite plugin

&#x20; server: {

&#x20;   host: "0.0.0.0",

&#x20;   port: 5173,

&#x20;   hmr: { clientPort: 443 },          // Cloudflare Tunnel HMR fix

&#x20; },

});

```



Setting `base: "./"` is critical — it produces relative asset paths that work identically on `vijaykrsha.online`, `\*.pages.dev`, and `localhost:8080` in Docker. \[blog.amirasyraf](https://blog.amirasyraf.com/vite-dev-cloudflare-tunnel/)



\### Tailwind CSS v4 Dark Mode



The project uses Tailwind v4's `@custom-variant` directive (not the old `darkMode: "class"` config): \[tailwindcss](https://tailwindcss.com/docs/dark-mode)



```css

/\* src/index.css \*/

@import "tailwindcss";

@custom-variant dark (\&:where(.dark, .dark \*));

```



A FOUC-prevention script in `index.html` applies the theme class before the first paint, and `ThemeContext.tsx` persists the choice to `localStorage`. \[medium](https://medium.com/@mrmendoza-dev/quick-setup-dark-mode-with-tailwind-css-and-vite-af21ff9d6cf1)



\### Soft Color Palette



The theme uses gentle, muted tones — not harsh blacks or pure whites:



| Mode | Background | Surface | Primary Accent | Text |

|------|-----------|---------|---------------|------|

| Light | `#fdfbf7` (cream-50) | `#f7f3eb` (cream-100) | `#a78bfa` (glow-500) | `#161b26` (night-800) |

| Dark | `#0f1219` (night-900) | `#161b26` (night-800) | `#a78bfa` (glow-500) | `#f7f3eb` (cream-100) |



Supporting tones include sage greens (`#7a9168`) for secondary actions and mist blues (`#6b8299`) for muted text.



\### Docker: Multi-Stage Nginx



```dockerfile

\# Stage 1 — build

FROM node:22-alpine AS build

RUN npm ci \&\& npm run build



\# Stage 2 — serve

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist /usr/share/nginx/html

```



The `nginx.conf` includes SPA fallback (`try\_files $uri $uri/ /index.html`), gzip compression, and 1-year cache headers for static assets. \[techoral](https://techoral.com/react/react-docker.html)



\### Cloudflare Pages + Tunnel Config



\*\*Pages\*\* (frontend — `vijaykrsha.online`):

\- Build command: `npm run build`  

\- Output directory: `dist`  

\- Framework preset: React (Vite) \[developers.cloudflare](https://developers.cloudflare.com/pages/configuration/build-configuration/)



\*\*Tunnel\*\* (backend API — `api.vijaykrsha.online`):



```yaml

\# .cloudflare/config.yml

ingress:

&#x20; - hostname: api.vijaykrsha.online

&#x20;   service: http://localhost:8000

&#x20; - service: http\_status:404

```



This mirrors the architecture you're already using for your rent-app: Cloudflare Pages for the frontend SPA, and a tunnel for the backend. \[perplexity](https://www.perplexity.ai/search/5d6ca224-39fa-4528-b4a8-70d00f5a3d96)



\## Content Summary by Page



| Page | Content |

|------|---------|

| \*\*Home\*\* | Hero with name, tagline, 3 highlight cards (Legal Research, Data Analysis, Confidentiality), CTA buttons |

| \*\*About\*\* | PG in Political Science (IGNOU), Law from Bundelkhand University, 6 expertise areas in a grid |

| \*\*Freelance\*\* | 4 service cards (Legal Research, Contract Drafting, Data/Excel Dashboards, Legal-Tech Integration), 3 working principles (NDA by default, Data Integrity, 3+ years) |

| \*\*Portfolio\*\* | 4 project cards across Legal and Tech categories |

| \*\*Contact\*\* | Phone (+91-9599130381), both emails, website link, location, NDA notice |



\## Quick Start Commands



```bash

\# Install \& dev

cd vijaykrsha-website

npm install

npm run dev              # → http://localhost:5173



\# Build

npm run build            # → /dist



\# Docker

docker compose up --build   # → http://localhost:8080



\# Deploy to Cloudflare Pages

\# 1. Push to Git → Cloudflare → Workers \& Pages → Import repo

\# 2. Build cmd: npm run build | Output: dist

\# 3. Custom domain: vijaykrsha.online

```



\## Deploy Checklist



\- Push the repo to GitHub/GitLab and import into Cloudflare Pages with build command `npm run build` and output directory `dist` \[developers.cloudflare](https://developers.cloudflare.com/pages/framework-guides/deploy-a-vite3-project/)

\- Add custom domain `vijaykrsha.online` in Pages → Custom domains

\- For backend API, create a Cloudflare Tunnel and route `api.vijaykrsha.online` → `http://localhost:8000` using the config in `.cloudflare/config.yml` \[developers.cloudflare](https://developers.cloudflare.com/tunnel/setup/)

\- Set environment variables in Cloudflare Pages → Settings → Environment variables if you want to override the defaults in `site.ts` \[developers.cloudflare](https://developers.cloudflare.com/pages/configuration/build-configuration/)



All files are in the `vijaykrsha-website/` folder — download them, run `npm install \&\& npm run dev`, and you'll have the site running locally with the soft dark/light theme toggle working immediately.



Would you like me to add a contact form with a backend API endpoint (via your existing FastAPI/Cloudflare Tunnel setup), or should I generate additional pages like a Blog or Services detail page?

