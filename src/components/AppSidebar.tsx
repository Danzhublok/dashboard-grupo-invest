import { Link, useRouterState } from "@tanstack/react-router";
import {
  ArrowDownToLine,
  Ban,
  CircleDollarSign,
  LayoutDashboard,
  LogOut,
  Settings,
  Target,
  UserRoundCog,
  Users,
} from "lucide-react";

import logo from "@/assets/grupo-invest-logo.jpg?url";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth";

const adminItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Equipes", url: "/equipes", icon: Users },
  { title: "Vendas", url: "/vendas", icon: CircleDollarSign },
  { title: "Cancelamentos", url: "/cancelamentos", icon: Ban },
  { title: "Metas", url: "/metas", icon: Target },
  { title: "Saídas", url: "/saidas", icon: ArrowDownToLine },
  { title: "Usuários", url: "/usuarios", icon: UserRoundCog },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];

const representativeItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Equipes", url: "/equipes", icon: Users },
  { title: "Vendas", url: "/vendas", icon: CircleDollarSign },
  { title: "Cancelamentos", url: "/cancelamentos", icon: Ban },
  { title: "Metas", url: "/metas", icon: Target },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];

export function AppSidebar() {
  const { session, logout } = useAuth();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <img
            src={logo}
            alt="Grupo Invest"
            width={40}
            height={40}
            className="size-10 shrink-0 rounded-lg bg-background object-contain p-1"
          />
          {!collapsed && (
            <div className="leading-tight">
              <p className="text-sm font-semibold">Grupo Invest</p>
              <p className="text-xs opacity-70">Consultoria Master</p>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {(session?.role === "admin" ? adminItems : representativeItems).map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={pathname === item.url}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => void logout()}>
                  <LogOut className="h-4 w-4" />
                  {!collapsed && <span>Sair</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
