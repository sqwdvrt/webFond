import { redirect } from "next/navigation";

import { getAdminSession } from "@/lib/admin-auth/session";

import { loginAction } from "./actions";
import { LoginForm } from "./login-form";

export default async function AdminLoginPage() {
  if (await getAdminSession()) {
    redirect("/admin");
  }

  return <LoginForm action={loginAction} />;
}
