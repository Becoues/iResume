import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import { FileText } from "lucide-react";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "简历智评 - AI Resume Analyzer",
  description: "智能简历分析与评估平台",
};

function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 shadow-sm">
            <FileText className="h-4.5 w-4.5 text-white" strokeWidth={2.2} />
          </div>
          <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-violet-600 via-blue-600 to-indigo-600 bg-clip-text text-transparent">
            简历智评
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          <Link
            href="/"
            className="inline-flex items-center rounded-lg px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            上传简历
          </Link>
          <Link
            href="/resumes"
            className="inline-flex items-center rounded-lg px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            历史记录
          </Link>
        </nav>
      </div>
    </header>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={inter.variable}>
      <body className={`${inter.className} min-h-screen bg-background text-foreground`}>
        <div className="relative flex min-h-screen flex-col">
          <Header />
          <main className="flex-1">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
