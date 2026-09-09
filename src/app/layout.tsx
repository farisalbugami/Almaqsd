import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "منظومة المقصد",
  description: "النظام الإداري والتشغيلي والمالي لشركة المقصد لإدارة الأملاك والتسويق العقاري",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
