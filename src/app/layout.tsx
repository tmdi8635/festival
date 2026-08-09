import type { Metadata } from "next";
import MSWProvider from "@/providers/MSWProvider";
import ReactQueryProvider from "@/providers/ReactQueryProvider";
import SonnerProvider from "@/providers/SonnerProvider";
import ThemeProvider from "@/providers/ThemeProvider";
import ConfirmDialogHost from "@/components/ui/ConfirmDialogHost";
import "./globals.css";

export const metadata: Metadata = {
  title: "인력 에이전시 통합 관리 시스템",
  description: "행사 일정 · 인력 배치 · 인사 · 계약 · 정산을 한 곳에서 관리합니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <MSWProvider>
            <ReactQueryProvider>
              {children}
              <ConfirmDialogHost />
              <SonnerProvider />
            </ReactQueryProvider>
          </MSWProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
