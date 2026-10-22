const PROD_WS_ORIGIN = "wss://vega-api.vijaykrsha.online";

// The OTP WebSocket cannot ride the Pages function the way /api/* does —
// public/_redirects rewrites /* to /index.html, so it is dialled directly
// against the API host. NOTE: api.vijaykrsha.online belongs to Propaura.
function resolveWsBaseUrl(): string {
  if (typeof window === "undefined") return PROD_WS_ORIGIN;
  const { protocol, host, hostname } = window.location;
  // *.pages.dev is included so preview deployments reach the real backend
  // (there is no preview API host).
  const isProd =
    hostname === "vijaykrsha.online" ||
    hostname === "www.vijaykrsha.online" ||
    hostname.endsWith(".pages.dev");
  if (isProd) return PROD_WS_ORIGIN;
  // dev: localhost, LAN IP, and ngrok all stay same-origin, so a single
  // build works for all of them.
  return `${protocol === "https:" ? "wss:" : "ws:"}//${host}`;
}

/**
 * One screenshot in an app's slider. Mirrors the `SlideItem` shape the
 * Slideshow component accepts, minus the plain-string form — the app
 * config always carries a caption and an alt text.
 */
export type AppSlide = {
  src: string;
  alt?: string;
  caption?: string;
};

/** Frame shape for an app's screenshot slider. */
export type AppSlideRatio = "HORIZONTAL" | "PORTRAIT" | "SQUARE" | "CLASSIC" | "CINEMA";
/** How images sit inside the frame. Defaults to "BLUR". */
export type AppSlideFit = "BLUR" | "COVER" | "CONTAIN";

export type AppEntry = {
  title: string;
  category: string;
  icon?: string;
  status: "live" | "beta" | "coming-soon";
  description: string;
  features: readonly string[];
  techStack: readonly string[];
  logo?: string;
  screenshots?: readonly AppSlide[];
  /** Defaults to "HORIZONTAL" (16:9) when omitted. */
  slideRatio?: AppSlideRatio;
  /** Defaults to "BLUR" when omitted. */
  slideFit?: AppSlideFit;
  link: { label: string; url: string };
  tags: readonly string[];
};

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
    wsBaseUrl: resolveWsBaseUrl(),
    contactPath: "/vks/api/contact",
  },

  // The apps catalogue lives on its own subdomain. `canonicalOrigin` is
  // where every other page of the site belongs — links on the apps
  // subdomain point back here so the two hosts never compete for the
  // same content.
  appsUrl: "https://apps.vijaykrsha.online/apps",
  canonicalOrigin: "https://vijaykrsha.online",

  nav: [
    { label: "Home", path: "/" },
    { label: "About", path: "/about" },
    { label: "Freelance", path: "/freelance" },
    { label: "Portfolio", path: "/portfolio" },
    { label: "Apps", path: "/apps" },
    { label: "Contact", path: "/contact" },
  ],

  // Hero proof cards — deliberately distinct from whyHireMe so the hero
  // does not repeat the same value propositions.
  heroProof: [
    {
      label: "LL.B.-Qualified Research",
      detail: "Case law, statutes & compliance work",
      icon: "scale",
    },
    {
      label: "Data-Driven Deliverables",
      detail: "Excel · Python · interactive dashboards",
      icon: "chart",
    },
    {
      label: "24-Hour Response",
      detail: "Monday–Saturday, IST business hours",
      icon: "clock",
    },
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
      status: "live",
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
      screenshots: [
        {
          src: "/vega-share-screenshot.png",
          alt: "Vega Share sending a file over WiFi",
          caption: "Send a file to any browser on the same network",
        },
        {
          src: "/vega-share-feature.png",
          alt: "Vega Share browser preview",
          caption: "Preview documents, images, video and audio in the browser",
        },
      ],
      slideRatio: "HORIZONTAL",
      slideFit: "BLUR",
      link: { label: "Download APK", url: "https://github.com/Kvijay199428/VEGA-SHARE/releases/download/v1.0.1/vega-share-1.0.1.apk" },
      tags: ["Android", "WiFi", "File Transfer", "Browser", "HTTPS"],
    },
    {
      title: "Rent App Management",
      category: "Web",
      icon: "building",
      status: "live",
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
    {
      title: "VEGA STING",
      category: "Android",
      icon: "shield",
      status: "live",
      description:
        "Privacy-first audio and video recorder for Android. Capture with the front and rear cameras at once, keep every recording on your own device, and share it only when you decide to.",
      features: [
        "Dual-camera composite capture — front and rear recorded into one file",
        "Foreground recording that keeps running with the screen off",
        "Everything stays on the device — no account, no ads, no analytics",
        "Signature, timestamp and watermark overlay on new recordings",
        "Trash with 30-day retention, restore and permanent delete",
        "Quick Settings tile, home-screen widget and app shortcuts to start recording fast",
      ],
      techStack: [
        "Android",
        "Kotlin",
        "Jetpack Compose",
        "Camera2",
        "MediaRecorder",
        "Room",
        "DataStore",
        "OpenGL",
      ],
      logo: "https://raw.githubusercontent.com/Kvijay199428/vega-sting/main/.assets/dark/app-icons/android/playstore-icon.png",
      screenshots: [
        {
          src: "https://raw.githubusercontent.com/Kvijay199428/vega-sting/main/docs/screenshots/01-consent.png",
          alt: "VEGA STING first-run consent screen",
          caption: "Nothing records until you accept the terms",
        },
        {
          src: "https://raw.githubusercontent.com/Kvijay199428/vega-sting/main/docs/screenshots/02-home.png",
          alt: "VEGA STING recording library",
          caption: "Your library — every recording stored on the device",
        },
        {
          src: "https://raw.githubusercontent.com/Kvijay199428/vega-sting/main/docs/screenshots/03-recording.png",
          alt: "VEGA STING recording in progress",
          caption: "Live REC indicator with codec, resolution and file target",
        },
        {
          src: "https://raw.githubusercontent.com/Kvijay199428/vega-sting/main/docs/screenshots/09-dual-camera.png",
          alt: "VEGA STING dual camera settings",
          caption: "Dual camera — front and rear composited into one file",
        },
        {
          src: "https://raw.githubusercontent.com/Kvijay199428/vega-sting/main/docs/screenshots/11-overlay.png",
          alt: "VEGA STING watermark overlay settings",
          caption: "Timestamp, signature and watermark overlay",
        },
        {
          src: "https://raw.githubusercontent.com/Kvijay199428/vega-sting/main/docs/screenshots/07-settings.png",
          alt: "VEGA STING settings screen",
          caption: "Setup — hardware, storage, recording and safety options",
        },
        {
          src: "https://raw.githubusercontent.com/Kvijay199428/vega-sting/main/docs/screenshots/05-trash.png",
          alt: "VEGA STING trash screen",
          caption: "Trash with 30-day retention — restore or delete for good",
        },
        {
          src: "https://raw.githubusercontent.com/Kvijay199428/vega-sting/main/docs/screenshots/10-about-developer.png",
          alt: "VEGA STING about and developer screen",
          caption: "About — version, build and developer",
        },
      ],
      slideRatio: "HORIZONTAL",
      slideFit: "BLUR",
      link: {
        label: "Download APK",
        url: "https://github.com/Kvijay199428/vega-sting/releases/download/v3.0.0/vega-sting-stable-3.0.0.apk",
      },
      tags: ["Android", "Recorder", "Dual Camera", "Privacy", "Offline"],
    },
  ] as readonly AppEntry[],
} as const;
