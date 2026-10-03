import type { Metadata } from "next";
import "@fontsource-variable/google-sans-flex";
import "@fontsource-variable/google-sans-code";
import "./globals.css";

export const metadata: Metadata = {
  title: "Codebase Intellisense",
  description: "AI-powered codebase understanding and search.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased dark"
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
