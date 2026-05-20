import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Header } from "@/components/Header";
import { Providers } from "./providers";
import "./globals.css";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nox — Pay in the dark",
  description:
    "Privacy-themed token launch on Base. Genesis sale, Uniswap v4 hook, stealth payments with mining rewards.",
  icons: {
    icon: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="relative font-sans">
        <Providers>
          <div className="relative z-10 flex min-h-screen flex-col">
            <Header />
            <main className="flex-1">{children}</main>
            <footer className="border-t border-veil/40 py-8 mt-24">
              <div className="mx-auto max-w-6xl px-6 text-center text-sm text-mist">
                Nox · Privacy-themed launch on Base · Built with Uniswap v4 hooks
              </div>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
