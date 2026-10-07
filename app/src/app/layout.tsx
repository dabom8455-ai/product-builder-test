import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "카페댐 — 카페 운영 올인원",
  description: "리뷰 답글, 원가 계산, 알바 근태, 홍보 포스터, 손익, 메뉴 분석을 한 곳에서",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#6b4f3a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        {/* App Router 의 루트 레이아웃이라 모든 화면에 적용된다 */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;600;700&display=swap"
        />
      </head>
      <body className="min-h-full">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
