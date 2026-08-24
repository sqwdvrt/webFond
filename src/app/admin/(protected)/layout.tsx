import { requireAdminSession } from "@/lib/admin-auth/session";

import { AdminShell } from "./admin-shell";

export default async function ProtectedAdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireAdminSession();

  return <AdminShell username={session.username}>{children}</AdminShell>;
}
