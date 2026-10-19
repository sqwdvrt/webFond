"use server";

import { requireAdminSession } from "@/lib/admin-auth/session";
import { safeMessagesReturnTo } from "@/features/admin-messages/filters";
import { parseContactSelection, moveContactSelection, ContactSelectionConflict, type ContactBulkState } from "@/features/admin-messages/bulk";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  updateContactRequestMutation,
  type ContactMutationState,
} from "@/features/admin-messages/mutation";

export async function updateContactRequestAction(
  id: string,
  _previousState: ContactMutationState,
  formData: FormData,
): Promise<ContactMutationState> {
  void _previousState;
  const outcome = await updateContactRequestMutation(id, formData);
  if (!outcome.ok) return outcome.state;

  for (const path of new Set([...outcome.effect.revalidate, "/admin/changes"])) {
    if (path === "/admin") revalidatePath(path, "layout");
    else revalidatePath(path);
  }
  redirect(outcome.effect.redirectTo);
}

export async function updateContactRequestWithReturnAction(
  id: string,
  returnTo: string,
  previousState: ContactMutationState,
  formData: FormData,
): Promise<ContactMutationState> {
  formData.set("returnTo", returnTo);
  return updateContactRequestAction(id, previousState, formData);
}

export async function moveContactSelectionAction(
  _previous: ContactBulkState,
  formData: FormData,
): Promise<ContactBulkState> {
  await requireAdminSession();
  const parsed = parseContactSelection(formData);
  if (!parsed) return { status: "error", message: "Выберите от 1 до 25 писем и действие для текущей папки." };
  try {
    await moveContactSelection(parsed);
  } catch (error) {
    return { status: "error", message: error instanceof ContactSelectionConflict
      ? "Письма изменились. Обновите страницу и выберите их заново. Ни одно письмо не перемещено."
      : "Не удалось переместить письма. Повторите попытку." };
  }
  for (const path of ["/admin", "/admin/messages", "/admin/changes", ...parsed.rows.map((row) => `/admin/messages/${row.id}`)]) {
    if (path === "/admin") revalidatePath(path, "layout");
    else revalidatePath(path);
  }
  redirect(safeMessagesReturnTo(formData.get("returnTo")));
}
