import type { Metadata } from "next";
import { headers } from "next/headers";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const host = headersList.get("host") || "";

  if (host === "cab.mozority.pro") {
    return {
      title: "Mozority Cheat Cabinet",
      description: "Precision. Stealth. Performance. New cheat-legend is here.",
      icons: {
        icon: "/mozority.ico",
      },
    };
  }

  return {
    title: "KeyVault — Secure License Management",
    description: "High-security license management system with hardware ID locking and encrypted validation.",
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased`}>
        <div className="bg-ambient" />
        {children}
      </body>
    </html>
  );
}
