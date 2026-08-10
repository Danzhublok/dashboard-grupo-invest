import type { ReactNode } from "react";

import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useStore } from "@/lib/store";

export function AppLayout({ title, children }: { title: string; children: ReactNode }) {
  const { erro } = useStore();
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full min-w-0 bg-background">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background/80 px-3 backdrop-blur sm:px-4">
            <SidebarTrigger />
            <span className="truncate text-sm font-medium text-muted-foreground">{title}</span>
          </header>
          {erro && (
            <div className="mx-3 mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive sm:mx-4 md:mx-8">
              Não foi possível sincronizar o painel com o Supabase: {erro}
            </div>
          )}
          <main className="min-w-0 flex-1 overflow-x-hidden p-3 sm:p-4 md:p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
