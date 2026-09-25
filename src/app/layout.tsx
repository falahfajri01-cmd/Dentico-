import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jb",
});

export const metadata: Metadata = {
  title: "Dentico Finance — Digital Finance Workbook",
  description:
    "Daily Control Hub untuk rekonsiliasi omzet klinik gigi: aplikasi, spreadsheet cabang, dan laporan shift dalam satu workbook.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id" className={`${hanken.variable} ${jetbrains.variable}`}>
      <head>
        <Script src="/env-config.js" strategy="beforeInteractive" />
      </head>
      <body className="bg-[#F8F9FA] font-sans text-[#111827] antialiased">{children}</body>
    </html>
  );
}
