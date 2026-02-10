import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import AuthProvider from "@/components/AuthProvider";
import { BrandingProvider } from "@/lib/branding";
import { QueryProvider } from "@/providers/query-provider";
import { ThemeProvider } from "@/lib/theme-provider";
import { Toaster } from "sonner";
import { startSlackBots } from "@/lib/slack-bot-worker";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Initialize Slack bots for all three core libraries on startup
// Each library can have its own bot instance with separate credentials
startSlackBots(["it", "knowledge", "gtm"]).catch((error) => {
  console.error("Failed to start Slack bots:", error);
});

export const metadata: Metadata = {
  title: "Transparent Trust",
  description: "Knowledge-powered AI assistant with full transparency into prompts and reasoning.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          <AuthProvider>
            <QueryProvider>
              <BrandingProvider>
                <Toaster position="top-right" richColors closeButton />
                <Sidebar />
                <main style={{ marginLeft: "240px" }}>
                  {children}
                </main>
              </BrandingProvider>
            </QueryProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
