import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "نظام فنية — بوابة الطلاب",
  description: "بوابة طلاب قسم التربية الفنية — متابعة الحضور والتقييمات ورفع الأعمال",
  manifest: "/manifest-student.json",
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
};

export default function SystemLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
