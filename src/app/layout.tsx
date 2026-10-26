import type { Metadata } from "next";
import { PrepShell } from "@/components/prep/shell";
import "./globals.css";
export const metadata: Metadata = {
  title: "iResume · 面试准备工作台",
  description: "从候选人经历到有依据的问题，快速做好下一场面试的准备。",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <PrepShell>{children}</PrepShell>
      </body>
    </html>
  );
}
