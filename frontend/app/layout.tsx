import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const archivo = Archivo({ subsets: ["latin"], weight: ["500", "700", "800"], variable: "--font-archivo" });
const plex = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-plex" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: "RepairCall — pay for the repair guide that is missing",
  description:
    "Sponsors fund calls for new iFixit repair guides. Anyone nominates a guide with a stake; GenLayer validators read it from iFixit, check it in code and read its steps. Accepted guides pay the scout now and hold the author's share for the author.",
  manifest: "/site.webmanifest",
  icons: { icon: [{ url: "/favicon.svg", type: "image/svg+xml" }] },
};

export const viewport: Viewport = {
  themeColor: "#F2EDE3",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${archivo.variable} ${plex.variable} ${jetbrains.variable}`}>
      <body className="pegboard">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
