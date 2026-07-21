# vijaykrsha-website

Personal website for Vijay Kumar Sharma — Legal & Tech Freelancer.

Built with **Vite + React 19 + TypeScript + Tailwind CSS v4**.

## Quick Start

```bash
npm install
npm run dev        # → http://localhost:5173
```

## Build

```bash
npm run build      # → /dist
npm run preview    # preview production build
```

## Docker

```bash
docker compose up --build   # → http://localhost:8080
```

## Deploy to Cloudflare Pages

1. Push to GitHub/GitLab
2. Cloudflare → Workers & Pages → Import repository
3. Build command: `npm run build`
4. Output directory: `dist`
5. Add custom domain: `vijaykrsha.online`

## Project Structure

```
src/
├── config/site.ts          # All site content (single source of truth)
├── context/ThemeContext.tsx # Dark/light theme with localStorage
├── components/Layout.tsx   # Header + nav + footer
├── pages/
│   ├── Home.tsx            # Hero + highlight cards
│   ├── About.tsx           # Qualifications + expertise
│   ├── Freelance.tsx       # Services + working principles
│   ├── Portfolio.tsx       # Project showcase
│   ├── Contact.tsx         # Contact info + NDA notice
│   └── NotFound.tsx        # 404 page
├── App.tsx                 # Router setup
├── main.tsx                # Entry point
└── index.css               # Tailwind v4 + color palette
```

## Theme

Soft muted palette with dark/light toggle:

| Mode | Background | Surface | Accent | Text |
|------|-----------|---------|--------|------|
| Light | `#fdfbf7` | `#f7f3eb` | `#a78bfa` | `#161b26` |
| Dark | `#0f1219` | `#161b26` | `#a78bfa` | `#f7f3eb` |

## License

Private. All rights reserved.
