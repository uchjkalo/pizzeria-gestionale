import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Al Cjanton — Gestionale",
  description: "Sistema gestionale pizzeria",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it">
      <body className="bg-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}