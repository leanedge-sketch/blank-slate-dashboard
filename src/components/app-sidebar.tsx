import { Link, useRouterState } from "@tanstack/react-router";
import {
  ArrowRightLeft,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  PackageSearch,
  Settings,
  User,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";

const mainItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Profile", url: "/profile", icon: User },
  { title: "Settings", url: "/settings", icon: Settings },
];

const logisticsItems = [
  {
    title: "Stock Availability",
    url: "/logistics/stock-availability",
    icon: PackageSearch,
  },
  {
    title: "Stock Movements",
    url: "/logistics/stock-movements",
    icon: ListOrdered,
  },
  {
    title: "Inter-Company Transfers",
    url: "/logistics/intercompany-transfer",
    icon: ArrowRightLeft,
  },
];

function initialsFor(value: string) {
  const base = value.split("@")[0] ?? value;
  const parts = base.split(/[._\-\s]+/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  return (letters || base.slice(0, 2)).toUpperCase();
}

export function AppSidebar() {
  const currentPath = useRouterState({
    select: (router) => router.location.pathname,
  });
  const { user, signOut } = useAuth();

  const email = user?.email ?? "";
  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ??
    (user?.user_metadata?.name as string | undefined) ??
    email.split("@")[0] ??
    "Account";
  const initials = initialsFor(displayName || email || "U");

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={currentPath === item.url}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Logistics &amp; Stock</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {logisticsItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={currentPath === item.url}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {user && (
        <SidebarFooter className="border-t">
          <div className="flex items-center gap-2 p-2 group-data-[collapsible=icon]:justify-center">
            <Avatar className="h-8 w-8 ring-2 ring-slate-200">
              <AvatarFallback className="bg-gradient-to-br from-sky-500 to-indigo-600 text-xs font-semibold text-white">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-medium text-slate-900">
                {displayName}
              </p>
              <p className="truncate text-xs text-slate-500">{email}</p>
            </div>
            <button
              type="button"
              onClick={() => signOut()}
              title="Sign out"
              aria-label="Sign out"
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors group-data-[collapsible=icon]:hidden"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
