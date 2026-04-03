import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ShipTrack — Order Tracking",
  description: "Premium order tracking and customer relationship management for Shopify businesses",
  icons: {
    icon: "/shiptrack-logo.png",
    apple: "/shiptrack-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
