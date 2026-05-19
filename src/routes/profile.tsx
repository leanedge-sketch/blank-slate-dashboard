import { createFileRoute } from "@tanstack/react-router";
import { Building2, LogOut, Mail, Shield, User } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — LeanChem Connect" },
      {
        name: "description",
        content: "Manage your account details, role, and workspace preferences.",
      },
    ],
  }),
  component: ProfilePage,
});

function getInitials(value: string) {
  const base = value.split("@")[0] ?? value;
  const parts = base.split(/[._-\s]+/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  return (letters || base.slice(0, 2)).toUpperCase();
}

function ProfilePage() {
  const { user, employee, employeeRole, permissions, signOut } = useAuth();

  const email = user?.email ?? "";
  const metaName =
    employee?.name ??
    (user?.user_metadata?.full_name as string | undefined) ??
    (user?.user_metadata?.name as string | undefined) ??
    email.split("@")[0] ??
    "Account";
  const role = employeeRole ?? "Member";
  const entity =
    (user?.user_metadata?.entity as string | undefined) ??
    "LeanChem Industrial PLC";
  const initials = getInitials(metaName || email || "U");
  const grantedSections = (
    [
      ["CRM", permissions.canViewCRM],
      ["PMS", permissions.canViewPMS],
      ["Sales Pipeline", permissions.canViewSalesPipeline],
      ["Stock", permissions.canViewStock],
    ] as const
  )
    .filter(([, ok]) => ok)
    .map(([label]) => label);

  return (
    <div className="min-h-full bg-slate-50">
      <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        {/* Header */}
        <div className="space-y-2">
          <p className="inline-flex items-center text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
            Account
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Profile
          </h1>
          <p className="text-sm text-slate-600">
            Your account details and workspace preferences.
          </p>
        </div>

        {/* Identity card */}
        <Card className="bg-white">
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 ring-2 ring-slate-200">
                  <AvatarFallback className="bg-gradient-to-br from-sky-500 to-indigo-600 text-lg font-semibold text-white">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <CardTitle className="text-xl text-slate-900">
                    {metaName}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-1.5 text-slate-600">
                    <Mail className="h-3.5 w-3.5" />
                    {email}
                  </CardDescription>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Badge
                      variant="secondary"
                      className="border-transparent bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
                    >
                      <Shield className="mr-1 h-3 w-3" />
                      {role}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="border-transparent bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200"
                    >
                      <Building2 className="mr-1 h-3 w-3" />
                      {entity}
                    </Badge>
                  </div>
                  {user?.id && (
                    <p className="pt-1 text-xs text-slate-400 font-mono">
                      ID: {user.id}
                    </p>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                className="shadow-sm"
                onClick={() => signOut()}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Account details form */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-slate-900">
              <User className="h-4 w-4 text-slate-500" />
              Personal details
            </CardTitle>
            <CardDescription>
              These fields will sync with your account once auth is connected.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full name</Label>
                <Input
                  id="fullName"
                  defaultValue={metaName}
                  className="focus-visible:ring-2 focus-visible:ring-primary/40"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  defaultValue={email}
                  disabled
                  className="bg-slate-50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Input id="role" defaultValue={role} disabled className="bg-slate-50" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="entity">Entity</Label>
                <Input
                  id="entity"
                  defaultValue={entity}
                  disabled
                  className="bg-slate-50"
                />
              </div>
            </div>

            <Separator />

            <div className="flex justify-end gap-2">
              <Button variant="outline">Cancel</Button>
              <Button className="shadow-sm hover:shadow-md transition-shadow">
                Save changes
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
