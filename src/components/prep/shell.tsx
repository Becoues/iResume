"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight,
  BookOpen,
  FilePlus2,
  FolderOpen,
  Settings2,
} from "lucide-react";

export function PrepShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/login") return <>{children}</>;
  const links = [
    { href: "/", label: "新的面试准备", icon: FilePlus2 },
    { href: "/resumes", label: "我的简报", icon: FolderOpen },
    { href: "/settings", label: "模型设置", icon: Settings2 },
  ];
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>
      <aside className="sidebar no-print">
        <Link href="/" className="brand" aria-label="iResume 首页">
          <span className="brand-mark">
            <BookOpen size={22} />
          </span>
          <span>
            iResume<span className="brand-sub">面试准备工作台</span>
          </span>
        </Link>
        <div className="sidebar-label">WORKSPACE</div>
        <nav aria-label="主导航">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`nav-item ${pathname === href || (href === "/resumes" && pathname.startsWith("/resumes/")) ? "active" : ""}`}
              aria-current={pathname === href ? "page" : undefined}
            >
              <Icon size={18} />
              <span>{label}</span>
              {href === "/" && <span className="nav-plus">+</span>}
            </Link>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="small-eyebrow">
            BETTER QUESTIONS.
            <br />
            BETTER CONVERSATIONS.
          </span>
          <p>
            读懂经历，带着好问题
            <br />
            开始下一场面试。
          </p>
          <span className="sidebar-note-arrow">
            <ArrowUpRight size={20} />
          </span>
        </div>
        <div className="sidebar-footer">
          <span className="status-dot" /> 专注面试前的准备
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar no-print">
          <span>
            {pathname === "/settings"
              ? "工作台 / 模型设置"
              : pathname.startsWith("/resumes/")
                ? "我的简报 / 候选人简报"
                : pathname === "/resumes"
                  ? "工作台 / 我的简报"
                  : "工作台 / 新的面试准备"}
          </span>
          <span className="topbar-tag">INTERVIEW PREP</span>
        </header>
        <main id="main-content">{children}</main>
        <footer className="page-footer no-print">
          iResume <span>·</span> 让每个问题都有依据
        </footer>
      </div>
    </div>
  );
}
