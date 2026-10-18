import { countNewContactRequests } from "@/features/admin-messages/repository";
import { requireAdminSession } from "@/lib/admin-auth/session";

import { AdminShell } from "./admin-shell";

export const dynamic = "force-dynamic";

type ProtectedAdminLayoutDependencies = Readonly<{
  countNewContactRequests: typeof countNewContactRequests;
  requireAdminSession: typeof requireAdminSession;
}>;

const defaultDependencies: ProtectedAdminLayoutDependencies = {
  countNewContactRequests,
  requireAdminSession,
};

export async function renderProtectedAdminLayout(
  children: React.ReactNode,
  dependencies: ProtectedAdminLayoutDependencies = defaultDependencies,
) {
  const session = await dependencies.requireAdminSession();
  const newContactRequestCount = await dependencies.countNewContactRequests();

  return (
    <AdminShell
      newContactRequestCount={newContactRequestCount}
      username={session.username}
    >
      {children}
    </AdminShell>
  );
}

export default async function ProtectedAdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return renderProtectedAdminLayout(children);
}
