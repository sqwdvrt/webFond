import { getAdminNotifications } from "@/features/admin-dashboard/notifications";
import { countNewContactRequests } from "@/features/admin-messages/repository";
import { requireAdminSession } from "@/lib/admin-auth/session";

import { AdminShell } from "./admin-shell";

export const dynamic = "force-dynamic";

type ProtectedAdminLayoutDependencies = Readonly<{
  countNewContactRequests: typeof countNewContactRequests;
  getAdminNotifications: typeof getAdminNotifications;
  requireAdminSession: typeof requireAdminSession;
}>;

const defaultDependencies: ProtectedAdminLayoutDependencies = {
  countNewContactRequests,
  getAdminNotifications,
  requireAdminSession,
};

export async function renderProtectedAdminLayout(
  children: React.ReactNode,
  dependencies: ProtectedAdminLayoutDependencies = defaultDependencies,
) {
  const session = await dependencies.requireAdminSession();
  const [newContactRequestCount, notifications] = await Promise.all([
    dependencies.countNewContactRequests(),
    dependencies.getAdminNotifications(),
  ]);

  return (
    <AdminShell
      newContactRequestCount={newContactRequestCount}
      notificationCount={notifications.alerts.length}
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
