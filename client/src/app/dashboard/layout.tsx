import { AppShell } from '@/components/layout/AppShell';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell>
      <div className="max-w-[1100px] mx-auto w-full h-full">
        {children}
      </div>
    </AppShell>
  );
}
