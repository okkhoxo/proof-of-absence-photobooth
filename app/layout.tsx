import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "부재의 증명사진 | Proof of Absence",
  description: "원본은 없습니다",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
