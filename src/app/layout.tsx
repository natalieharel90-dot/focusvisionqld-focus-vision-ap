import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Focus Vision Staff Dashboard",
  description:
    "Clinical staff dashboard for the Focus Vision Recovery Companion.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="calm">
      <body className="font-sans">{children}</body>
    </html>
  );
}
