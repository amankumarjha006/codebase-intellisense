import { AppShell } from '@/components/layout/AppShell';

export default function RepositoriesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell>
      {/*
        This layout wraps the repositories dashboard and individual repositories.
        The AppShell internally handles the sidebar, header, and main scroll area.
      */}
      <div className="max-w-7xl mx-auto w-full h-full">
        {children}
      </div>
    </AppShell>
  );
}
