import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "YucaFish — Tu bitácora de pesca", template: "%s · YucaFish" },
  description: "Registra tus salidas, capturas, fotografías y récords personales.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg", apple: "/favicon.svg" },
  openGraph: { title: "YucaFish — Tu historial de pesca, siempre contigo", description: "Tu bitácora privada de salidas, capturas y récords.", type: "website", locale: "es_MX", images: [{ url: "/og.png", width: 1732, height: 909, alt: "YucaFish — Tu historial de pesca, siempre contigo" }] },
  twitter: { card: "summary_large_image", title: "YucaFish", description: "Tu historial de pesca, siempre contigo.", images: ["/og.png"] },
};
export const viewport: Viewport = { themeColor: "#0d73eb", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="es"><body className={inter.variable}><a className="skip-link" href="#main-content">Saltar al contenido</a>{children}</body></html>; }
