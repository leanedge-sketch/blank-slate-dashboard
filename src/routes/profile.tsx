import { createFileRoute } from "@tanstack/react-router";
import { Building2, Mail, Shield, User } from "lucide-react";

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

function ProfilePage() {
  // Placeholder until AuthContext is wired into the new TanStack shell.
  const user = {
    name: "LeanChem User",
    email: "user@leanchem.com",
    role: "Operations",
    entity: "LeanChem Industrial PLC",
    initials: "LU",
  };

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
                    {user.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <CardTitle className="text-xl text-slate-900">
                    {user.name}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-1.5 text-slate-600">
                    <Mail className="h-3.5 w-3.5" />
                    {user.email}
                  </CardDescription>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Badge
                      variant="secondary"
                      className="border-transparent bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
                    >
                      <Shield className="mr-1 h-3 w-3" />
                      {user.role}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="border-transparent bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200"
                    >
                      <Building2 className="mr-1 h-3 w-3" />
                      {user.entity}
                    </Badge>
                  </div>
                </div>
              </div>
              <Button variant="outline" className="shadow-sm">
                Edit profile
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
                  defaultValue={user.name}
                  className="focus-visible:ring-2 focus-visible:ring-primary/40"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  defaultValue={user.email}
                  disabled
                  className="bg-slate-50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Input id="role" defaultValue={user.role} disabled className="bg-slate-50" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="entity">Entity</Label>
                <Input
                  id="entity"
                  defaultValue={user.entity}
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
