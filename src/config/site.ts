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
