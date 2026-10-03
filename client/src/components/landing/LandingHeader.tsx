"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Github } from "@/components/icons";
import { Menu, X } from "lucide-react";
import { easings, durations } from "@/lib/animations";

interface LandingHeaderProps {
  onLogin: () => void;
}

const navLinks = [
  { id: "how-it-works", label: "How it works" },
  { id: "features", label: "Features" }, // Assuming a features section exists or will exist
];

export function LandingHeader({ onLogin }: LandingHeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [heroCtaInView, setHeroCtaInView] = useState(true);
  
  // Note: the requirements mention "swap the label to Open dashboard if session check succeeds".
  // Since we only receive onLogin here, we'll assume "Continue with GitHub" for now.
  const ctaLabel = "Continue with GitHub";
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 8);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    // Scroll spy for sections
    const observers = new Map<string, IntersectionObserver>();
    
    navLinks.forEach(({ id }) => {
      const element = document.getElementById(id);
      if (element) {
        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                setActiveSection(id);
              }
            });
          },
          { rootMargin: "-20% 0px -80% 0px" }
        );
        observer.observe(element);
        observers.set(id, observer);
      }
    });

    // Observer for Hero CTA to toggle Navbar CTA style
    // The Hero CTA should have an id="hero-cta" added to it.
    const heroCtaObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setHeroCtaInView(entry.isIntersecting);
        });
      },
      { rootMargin: "0px 0px 0px 0px" }
    );
    const heroCtaEl = document.getElementById("hero-cta");
    if (heroCtaEl) heroCtaObserver.observe(heroCtaEl);
    // As a fallback, if we scroll past 60vh, assume hero is gone
    const fallbackScroll = () => {
      if (!document.getElementById("hero-cta")) {
        setHeroCtaInView(window.scrollY < window.innerHeight * 0.6);
      }
    };
    window.addEventListener("scroll", fallbackScroll, { passive: true });

    return () => {
      observers.forEach((obs) => obs.disconnect());
      heroCtaObserver.disconnect();
      window.removeEventListener("scroll", fallbackScroll);
    };
  }, []);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
      const handleEsc = (e: KeyboardEvent) => {
        if (e.key === "Escape") setMobileMenuOpen(false);
      };
      window.addEventListener("keydown", handleEsc);
      return () => {
        document.body.style.overflow = "";
        window.removeEventListener("keydown", handleEsc);
      };
    }
  }, [mobileMenuOpen]);

  const scrollTo = (id: string) => {
    setMobileMenuOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth" });
    }
  };

  const LogoMark = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0" aria-hidden="true">
      <rect x="4" y="6" width="16" height="2.5" rx="1.25" fill="currentColor" />
      <rect x="4" y="10.75" width="10" height="2.5" rx="1.25" fill="var(--accent)" />
      <rect x="4" y="15.5" width="13" height="2.5" rx="1.25" fill="currentColor" />
    </svg>
  );

  return (
    <>
      {/* Skip to content */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] px-4 py-2 bg-surface border border-border text-text rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:ring-text"
      >
        Skip to content
      </a>

      <header 
        className="sticky top-0 z-50 transition-colors duration-200"
        style={{
          backgroundColor: scrolled ? "rgba(15, 15, 14, 0.92)" : "transparent",
          borderBottom: scrolled ? "1px solid var(--border)" : "1px solid transparent"
        }}
      >
        <div className="container max-w-[1200px] mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
          <Link 
            href="/" 
            className="flex items-center gap-3 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:ring-text rounded-md"
            aria-label="Codebase Intellisense Home"
          >
            <LogoMark />
            <span className="font-medium text-[15px] sm:text-[16px] tracking-[-0.01em] text-text">
              Codebase Intellisense
            </span>
          </Link>
          
          {/* Desktop Nav */}
          <nav aria-label="Primary" className="hidden md:flex items-center gap-6 h-full">
            <div className="flex items-center gap-6 h-full relative">
              {navLinks.map(({ id, label }) => {
                const isActive = activeSection === id;
                return (
                  <button
                    key={id}
                    onClick={() => scrollTo(id)}
                    className="relative h-full flex items-center text-sm font-medium transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-text group"
                    style={{ color: isActive ? "var(--text)" : "var(--muted)" }}
                  >
                    <span className="group-hover:text-text transition-colors">{label}</span>
                    {isActive && (
                      <motion.div
                        layoutId="nav-underline"
                        className="absolute bottom-0 left-0 right-0 h-px bg-text"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
            
            <div className="flex items-center gap-3">
              <Link 
                href="https://github.com/amankumarjha006/codebase-intellisense" 
                target="_blank" 
                rel="noreferrer" 
                className="w-10 h-10 flex items-center justify-center text-muted hover:text-text transition-colors rounded-md outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:ring-text"
                aria-label="GitHub Repository"
                title="GitHub Repository"
              >
                <Github className="w-5 h-5" />
              </Link>
              
              <button 
                onClick={onLogin}
                className="h-9 px-4 rounded-lg font-medium text-sm transition-all duration-150 flex items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:ring-accent overflow-hidden"
                style={{
                  backgroundColor: heroCtaInView ? "transparent" : "var(--accent)",
                  color: heroCtaInView ? "var(--text)" : "#0F0F0E",
                  border: heroCtaInView ? "1px solid var(--border)" : "1px solid transparent"
                }}
                onMouseEnter={(e) => {
                  if (!heroCtaInView) e.currentTarget.style.backgroundColor = "var(--accent-text)";
                }}
                onMouseLeave={(e) => {
                  if (!heroCtaInView) e.currentTarget.style.backgroundColor = "var(--accent)";
                }}
              >
                <Github className="w-4 h-4 shrink-0" />
                <span>{ctaLabel}</span>
              </button>
            </div>
          </nav>

          {/* Mobile Menu Toggle */}
          <button
            className="md:hidden p-2 -mr-2 text-text outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-text rounded-md"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={mobileMenuOpen}
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* Mobile Nav Sheet */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: durations.entrance, ease: easings.entrance }}
            className="fixed inset-0 z-[100] bg-background flex flex-col md:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile Navigation"
          >
            <div className="h-16 px-4 flex items-center justify-between border-b border-border">
              <div className="flex items-center gap-3">
                <LogoMark />
                <span className="font-medium text-[15px] tracking-[-0.01em] text-text">
                  Codebase Intellisense
                </span>
              </div>
              <button
                className="p-2 -mr-2 text-text outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-text rounded-md"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu"
                autoFocus
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <nav className="flex-1 px-6 py-8 flex flex-col gap-6">
              {navLinks.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => scrollTo(id)}
                  className="text-left text-2xl font-medium text-text outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:ring-text rounded-sm w-fit"
                >
                  {label}
                </button>
              ))}
              <Link 
                href="https://github.com/amankumarjha006/codebase-intellisense" 
                target="_blank" 
                rel="noreferrer" 
                className="text-left text-2xl font-medium text-text outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:ring-text rounded-sm w-fit flex items-center gap-3"
              >
                <Github className="w-6 h-6" />
                GitHub
              </Link>
            </nav>
            
            <div className="p-6 border-t border-border">
              <button 
                onClick={() => {
                  setMobileMenuOpen(false);
                  onLogin();
                }}
                className="w-full h-11 rounded-lg bg-accent hover:bg-accent-text text-[#0F0F0E] font-medium text-base transition-colors duration-150 flex items-center justify-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:ring-accent shadow-none"
              >
                <Github className="w-5 h-5" />
                {ctaLabel}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
