import type { Metadata } from "next";
import { Inter, Barlow, Bebas_Neue } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
});

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-barlow",
});

const bebasNeue = Bebas_Neue({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-bebas",
});

export const metadata: Metadata = {
  title: "BeeSocial",
  description: "Seu link na bio. Gerencie seus links em um só lugar.",
  keywords: ["link na bio", "bio link", "criadores", "links", "link management"],
  openGraph: {
    title: "BeeSocial",
    description: "Seu link na bio. Gerencie seus links em um só lugar.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BeeSocial",
    description: "Seu link na bio. Gerencie seus links em um só lugar.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${barlow.variable} ${bebasNeue.variable} font-sans bg-bee-bg text-bee-text antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
