import { useRef, useState, useEffect, useCallback } from "react";
import TermsContent from "./TermsContent";

interface TermsScrollerProps {
  onScrollComplete: (completed: boolean) => void;
  isExperimental?: boolean;
}

const TermsScroller = ({ onScrollComplete, isExperimental }: TermsScrollerProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const progress = clientHeight >= scrollHeight ? 1 : scrollTop / (scrollHeight - clientHeight);
    setScrollProgress(Math.min(progress, 1));
    if (scrollTop + clientHeight >= scrollHeight - 20) onScrollComplete(true);
  }, [onScrollComplete]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    handleScroll();
    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  return (
    <div className="relative">
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-full bg-secondary z-10">
        <div className="w-full rounded-full bg-primary transition-all duration-150" style={{ height: `${scrollProgress * 100}%` }} />
      </div>
      <div ref={scrollRef} className="ml-4 h-[400px] overflow-y-auto pr-2 space-y-6 scroll-smooth">
        <TermsContent isExperimental={isExperimental} />
      </div>
      <div className="absolute bottom-0 left-4 right-0 h-12 bg-gradient-to-t from-card to-transparent pointer-events-none rounded-b-xl" />
    </div>
  );
};

export default TermsScroller;
