import type { Metadata } from "next";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";

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
      <body className="min-h-screen font-body">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
