import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HRT · HR Signals Terminal",
  description: "A Bloomberg-style terminal for people selling HR, hiring and payroll software into the Fortune 500.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-full flex flex-col crt">{children}</body>
    </html>
  );
}
