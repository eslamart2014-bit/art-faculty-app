import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import MaintenanceGuard from "@/components/MaintenanceGuard";
import BackButtonHandler from "@/components/BackButtonHandler";
import OfflineSyncManager from "@/components/OfflineSyncManager";
import SWRProvider from "@/components/SWRProvider";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import GlobalHaptics from "@/components/GlobalHaptics";

const cairo = Cairo({ subsets: ["arabic", "latin"] });

export const metadata: Metadata = {
  title: "نظام التربية الفنية — جامعة قنا",
  description: "المنظومة الرقمية لإدارة الحضور والتقييمات — قسم التربية الفنية — كلية التربية النوعية — جامعة قنا",
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
          <MaintenanceGuard>
            <BackButtonHandler />
            <GlobalHaptics />
            <SWRProvider>
              <ServiceWorkerRegister />
              <OfflineSyncManager />
              {children}
            </SWRProvider>
          </MaintenanceGuard>
        </div>
      </body>
    </html>
  );
}
