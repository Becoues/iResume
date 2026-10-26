"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ListTree } from "lucide-react";

export interface BriefSection {
  id: string;
  title: string;
  count?: number;
  children?: { id: string; title: string }[];
}

export function BriefOutline({ sections }: { sections: BriefSection[] }) {
  const [active, setActive] = useState("overview");
  const [expanded, setExpanded] = useState(false);
  const anchors = sections
    .flatMap((section) => [section.id, ...(section.children?.map((item) => item.id) ?? [])])
    .join("|");

  useEffect(() => {
    const ids = anchors.split("|");
    let frame = 0;
    const update = () => {
      frame = 0;
      // Leave space for the compact mobile outline above the selected chapter.
      const offset = window.matchMedia("(max-width: 900px)").matches ? 110 : 90;
      let current = ids[0];
      for (const id of ids) {
        const element = document.getElementById(id);
        if (element && element.getBoundingClientRect().top <= offset) current = id;
      }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 8) {
        current = ids[ids.length - 1];
      }
      setActive(current);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [anchors]);

  const currentSection = sections.find(
    (section) => section.id === active || section.children?.some((item) => item.id === active),
  );

  return (
    <aside className={`brief-outline panel no-print${expanded ? " is-expanded" : ""}`}>
      <div className="outline-heading">
        <ListTree size={18} />
        <h2>简报目录</h2>
        <span>{sections.length} 章</span>
      </div>
      <button
        type="button"
        className="outline-mobile-toggle"
        aria-expanded={expanded}
        aria-controls="brief-outline-navigation"
        onClick={() => setExpanded((value) => !value)}
      >
        <ListTree size={18} />
        <span>目录 <strong>{currentSection?.title}</strong></span>
        <ChevronDown size={17} />
      </button>
      <nav id="brief-outline-navigation" aria-label="简报章节" className="outline-navigation">
        <ol>
          {sections.map((section, index) => {
            const selected = currentSection?.id === section.id;
            return (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className={selected ? "is-active" : ""}
                  aria-current={active === section.id ? "location" : undefined}
                  onClick={() => setExpanded(false)}
                >
                  <span className="outline-number">{String(index + 1).padStart(2, "0")}</span>
                  <span>{section.title}</span>
                  {section.count !== undefined && <span className="outline-count">{section.count}</span>}
                </a>
                {section.children && (
                  <ol className="outline-questions">
                    {section.children.map((item, questionIndex) => (
                      <li key={item.id}>
                        <a
                          href={`#${item.id}`}
                          className={active === item.id ? "is-active" : ""}
                          aria-current={active === item.id ? "location" : undefined}
                          onClick={() => setExpanded(false)}
                          title={item.title}
                        >
                          <span className="outline-number">Q{questionIndex + 1}</span>
                          <span>{item.title}</span>
                        </a>
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      <p className="outline-footnote">点击章节或问题，快速定位</p>
    </aside>
  );
}
