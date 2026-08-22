import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AMS Pronos",
  description: "Pronostics statistiques football basés sur l'historique H2H",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="bg-slate-50">{children}</body>
    </html>
  );
}
