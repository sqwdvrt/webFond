import { redirect } from "next/navigation";

import { clearAdminSession } from "@/lib/admin-auth/session";

type LogoutDependencies = {
  clearSession: () => Promise<void>;
  navigate: (path: string) => never;
};

export async function performLogout({
  clearSession,
  navigate,
}: LogoutDependencies) {
  await clearSession();
  navigate("/admin/login");
}

export async function logoutAction() {
  "use server";

  await performLogout({ clearSession: clearAdminSession, navigate: redirect });
}
