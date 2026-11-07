import * as React from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { motion, AnimatePresence } from 'motion/react';

interface ChatLayoutProps {
  sidebar: React.ReactNode;
  main: React.ReactNode;
  sourcePanel: React.ReactNode | null;
  mobileSidebarOpen: boolean;
  onMobileSidebarClose: () => void;
  mobileSourceOpen: boolean;
  onMobileSourceClose: () => void;
}

export function ChatLayout({
  sidebar,
  main,
  sourcePanel,
  mobileSidebarOpen,
  onMobileSidebarClose,
  mobileSourceOpen,
  onMobileSourceClose,
}: ChatLayoutProps) {
  return (
    <div className="h-full w-full overflow-hidden">
      {/* Desktop Resizable Multi-Panel Layout */}
      <div className="hidden md:flex h-full w-full overflow-hidden">
        <Group orientation="horizontal" className="h-full w-full">
          <Panel
            id="chat-sidebar"
            defaultSize="22%"
            minSize="200px"
            maxSize="35%"
            className="flex flex-col min-w-0 h-full overflow-hidden"
          >
            {sidebar}
          </Panel>

          <Separator className="w-px bg-white/10 hover:bg-accent/50 cursor-col-resize transition-colors" />

          <Panel
            id="chat-main"
            minSize="40%"
            className="flex flex-col min-w-0 h-full overflow-hidden"
          >
            {main}
          </Panel>

          {sourcePanel && (
            <>
              <Separator className="w-px bg-white/10 hover:bg-accent/50 cursor-col-resize transition-colors" />
              <Panel
                id="chat-source"
                defaultSize="35%"
                minSize="25%"
                maxSize="50%"
                className="flex flex-col min-w-0 h-full overflow-hidden"
              >
                {sourcePanel}
              </Panel>
            </>
          )}
        </Group>
      </div>

      {/* Mobile Stacked View with Slide-Over Sheets */}
      <div className="md:hidden flex flex-col h-full w-full relative overflow-hidden">
        {main}

        {/* Mobile Sidebar Slide-Over Sheet */}
        <AnimatePresence>
          {mobileSidebarOpen && (
            <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 bg-black/70 backdrop-blur-xs"
                onClick={onMobileSidebarClose}
              />
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', stiffness: 350, damping: 32 }}
                className="relative w-4/5 max-w-xs h-full bg-surface-raised border-r border-white/10 shadow-2xl z-10 flex flex-col"
              >
                <div className="p-3 border-b border-white/10 flex items-center justify-between">
                  <span className="text-xs font-semibold text-text-primary">Chat history</span>
                  <button
                    type="button"
                    onClick={onMobileSidebarClose}
                    className="p-1 rounded text-text-tertiary hover:text-text-primary"
                    aria-label="Close chat history"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex-1 min-h-0 overflow-hidden">
                  {sidebar}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Mobile Source Panel Slide-Over Sheet */}
        <AnimatePresence>
          {mobileSourceOpen && sourcePanel && (
            <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 bg-black/70 backdrop-blur-xs"
                onClick={onMobileSourceClose}
              />
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', stiffness: 350, damping: 32 }}
                className="relative w-full h-[85vh] bg-surface-raised border-t border-white/10 shadow-2xl rounded-t-xl z-10 flex flex-col overflow-hidden"
              >
                {sourcePanel}
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

