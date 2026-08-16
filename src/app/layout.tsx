import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";

const cairo = Cairo({ subsets: ["arabic", "latin"] });

export const metadata: Metadata = {
  title: "نظام التربية الفنية",
  description: "نظام إدارة المتابعة الأكاديمية والغياب",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#2196F3",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <style dangerouslySetInnerHTML={{ __html: `
          @media (max-width: 768px) {
            .hide-on-mobile { display: none !important; }
          }
        `}} />
      </head>
      <body className={cairo.className}>
        <div className="app-container">
          {children}
        </div>
      </body>
    </html>
  );
}
