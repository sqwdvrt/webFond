"use server";

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

  for (const path of outcome.effect.revalidate) {
    revalidatePath(path);
  }
  redirect(outcome.effect.redirectTo);
}
