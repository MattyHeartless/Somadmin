import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const orbitron = localFont({
  src: "./fonts/Orbitron-VariableFont_wght.ttf",
  variable: "--font-orbitron",
  display: "swap",
  weight: "400 900",
});

const spaceGrotesk = localFont({
  src: "./fonts/SpaceGrotesk-VariableFont_wght.ttf",
  variable: "--font-space-grotesk",
  display: "swap",
  weight: "300 700",
});

export const metadata: Metadata = {
  title: "SOMA Admin",
  description: "Control operativo de SOMA Music Hub",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={`${orbitron.variable} ${spaceGrotesk.variable}`}>{children}</body>
    </html>
  );
}
