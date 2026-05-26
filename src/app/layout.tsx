import type { Metadata } from "next";
import localFont from "next/font/local";
import { Providers } from "@/components/providers";
import "./globals.css";

const outfit = localFont({
  src: [
    { path: "./fonts/GeistVF.woff", weight: "100 900" },
  ],
  variable: "--font-outfit",
  display: "swap",
});

const jetBrainsMono = localFont({
  src: [
    { path: "./fonts/JetBrainsMono-Regular.woff2", weight: "400" },
    { path: "./fonts/JetBrainsMono-Medium.woff2", weight: "500" },
  ],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Alfredo - DevOps AI Companion",
  description: "Enterprise serverless DevOps companion dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className={`${outfit.variable} ${jetBrainsMono.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
