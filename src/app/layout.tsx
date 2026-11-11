import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "클래스허브 (ClassHub) - 학교를 위한 실시간 협업 & 퀴즈 플랫폼",
  description: "패들렛과 카훗을 대체하는 학교 교실용 완전 무료 실시간 인터랙티브 에듀테크 서비스",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 selection:bg-indigo-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
