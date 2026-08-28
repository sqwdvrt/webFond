"use server";

import { headers } from "next/headers";

import {
  createDefaultSubmitDependencies,
  submitContact,
  type ContactFormState,
} from "@/features/contact/submit";

export type { ContactFormState };

export async function submitContactAction(
  state: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  return submitContact(
    state,
    formData,
    createDefaultSubmitDependencies(await headers()),
  );
}
