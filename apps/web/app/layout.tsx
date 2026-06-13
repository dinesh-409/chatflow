import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "../components/Providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ChatFlow — Multi-Model AI Platform",
  description: "Intelligent AI conversations powered by Gemini, GPT, Claude, and Llama. ChatFlow routes every query to the best model with memory, RAG, and web search.",
  keywords: ["AI", "chatbot", "Gemini", "GPT", "Claude", "multi-model", "AI platform"],
  openGraph: {
    title: "ChatFlow — Multi-Model AI Platform",
    description: "Intelligent AI conversations powered by multiple AI models with smart routing.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} dark`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased bg-[#0a0a0a] text-white">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
