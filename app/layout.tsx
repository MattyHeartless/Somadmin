import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SOMA Admin",
  description: "Control operativo de SOMA Music Hub",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
