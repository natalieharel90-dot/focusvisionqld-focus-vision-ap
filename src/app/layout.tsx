import { Suspense } from "react";
import type { Metadata } from "next";
import "./globals.css";
import { ScrollToErrorOnLoad } from "@/components/ScrollToErrorOnLoad";

export const metadata: Metadata = {
  title: "Focus Vision Staff Dashboard",
  description:
    "Clinical staff dashboard for the Focus Vision Recovery Companion.",
  manifest: "/manifest.json",
  themeColor: "#1C3A4F",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/icons/favicon-16.png", type: "image/png", sizes: "16x16" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="calm">
      <body className="font-sans">
        <Suspense>
          <ScrollToErrorOnLoad />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
