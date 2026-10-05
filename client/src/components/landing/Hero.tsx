"use client";

import { motion, useReducedMotion } from "motion/react";
import { Github } from "@/components/icons";
import { LiveDemo } from "./LiveDemo";

interface HeroProps {
  onLogin: () => void;
  error?: string | null;
}

// Simple text reveal component inspired by React Bits
function TextReveal({ text }: { text: string }) {
  const prefersReducedMotion = useReducedMotion();
  const words = text.split(" ");

  if (prefersReducedMotion) {
    return <span>{text}</span>;
  }

  return (
    <span className="inline-block text-balance">
      {words.map((word, i) => (
        <span key={i} className="inline-block overflow-hidden mr-[0.25em] align-top">
          <motion.span
            className="inline-block"
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{
              type: "spring",
              damping: 20,
              stiffness: 100,
              delay: i * 0.08,
            }}
          >
            {word}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

export function Hero({ onLogin, error }: HeroProps) {
  return (
    <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center h-full min-h-[60vh]">
      {/* Left Column: Hero Copy & CTA */}
      <div className="flex-1 order-2 lg:order-1 flex flex-col gap-6 max-w-2xl">
        <h1 className="text-[clamp(3rem,6vw,5.5rem)] font-medium leading-[1.1] tracking-[0.02em] md:tracking-[-0.02em] text-text max-w-[13ch]">
          <TextReveal text="Answers that point to the line." />
        </h1>

        <p className="text-muted text-base sm:text-[17px] leading-[1.6] max-w-[65ch]">
          Codebase Intellisense is an AI-powered repository understanding platform.
          Every answer shows the code it was drawn from, so you never have to guess where the context came from.
        </p>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-md w-fit">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4 mt-2">
          <button
            id="hero-cta"
            onClick={onLogin}
            className="px-5 py-2.5 rounded-lg bg-accent text-[#0F0F0E] font-medium transition-colors duration-150 hover:bg-accent-text flex items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:ring-accent shadow-none group"
          >
            <Github className="w-5 h-5 transition-transform group-hover:translate-x-0.5" />
            Continue with GitHub
          </button>

          <a
            href="#how-it-works"
            className="px-5 py-2.5 rounded-lg text-text hover:text-white transition-colors font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:ring-text opacity-80 hover:opacity-100"
          >
            See how it works
          </a>
        </div>
      </div>

      {/* Right Column: Visualization / Live Demo */}
      <div className="flex-1 order-1 lg:order-2 w-full max-w-[600px] mx-auto lg:max-w-none">
        <LiveDemo />
      </div>
    </div>
  );
}
