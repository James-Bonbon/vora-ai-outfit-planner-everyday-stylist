import { Instagram, Facebook, Mail } from "lucide-react";

const XIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const socials = [
  { icon: Instagram, href: "#", label: "Instagram" },
  { icon: Facebook, href: "#", label: "Facebook" },
  { icon: XIcon, href: "#", label: "X", isCustom: true },
];

const WelcomeFooter = () => (
  <footer className="bg-foreground text-background py-10 px-6">
    <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
      <span className="font-serif-display text-sm tracking-[0.2em] text-background/40">
        VORA
      </span>

      <div className="flex items-center gap-5">
        {socials.map((s) => (
          <a
            key={s.label}
            href={s.href}
            aria-label={s.label}
            className="text-background/30 hover:text-background transition-colors duration-300"
          >
            {s.isCustom ? <s.icon /> : <s.icon className="w-4 h-4" />}
          </a>
        ))}
        <span className="w-px h-4 bg-background/10" />
        <a
          href="mailto:vora.support@gmail.com"
          className="text-[10px] uppercase tracking-[0.2em] font-outfit text-background/30 hover:text-background transition-colors duration-300"
        >
          Contact Concierge
        </a>
      </div>

      <span className="text-[9px] uppercase tracking-[0.2em] font-outfit text-background/25">
        © {new Date().getFullYear()}
      </span>
    </div>
  </footer>
);

export default WelcomeFooter;
