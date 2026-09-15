import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "HRT · HR buying situations", description: "Which companies are in a buying situation for HR software right now, with the proof." };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (<html lang="en"><body>{children}</body></html>);
}
