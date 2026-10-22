import type { Metadata } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { ToastProvider } from "@/components/Toast";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});
const jakartaDisplay = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Cognicare",
  description:
    "Multimodal longitudinal cognitive-health monitoring and clinical decision support. MVP prototype.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${jakarta.variable} ${jakartaDisplay.variable} ${mono.variable}`}
    >
      <head>
        {/* Resolve the theme before first paint: an explicit user choice
            (localStorage `cognicare-theme`) wins, otherwise the OS preference
            applies via `prefers-color-scheme`. A `.dark` class is kept in sync
            so Tailwind `dark:` utilities match the CSS-variable theming. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var r=document.documentElement;var s=null;try{s=localStorage.getItem('cognicare-theme');}catch(e){}var t=(s==='light'||s==='dark')?s:null;if(t){r.setAttribute('data-theme',t);}else{r.removeAttribute('data-theme');}var dark=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);r.classList.toggle('dark',dark);var m=window.matchMedia('(prefers-color-scheme: dark)');m.addEventListener&&m.addEventListener('change',function(e){var tt=r.getAttribute('data-theme');if(tt!=='dark'&&tt!=='light')r.classList.toggle('dark',e.matches);});}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
