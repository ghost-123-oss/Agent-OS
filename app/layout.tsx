import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Agent OS — AI Requirement Counselor",
  description:
    "Turn vague ideas into crystal-clear, structured build prompts with multi-agent AI counseling.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased dark`}>
      <body className="min-h-full flex flex-col font-sans">
        {children}
        {/* Toaster must be at root level so toasts render above all page content */}
        <Toaster />
      </body>
    </html>
  );
}