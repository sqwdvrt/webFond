import { requireAdminSession } from "@/lib/admin-auth/session";

export default async function ProtectedAdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireAdminSession();
  return children;
}
