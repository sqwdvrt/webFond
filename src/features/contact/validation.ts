export type ContactFormValues = {
  name: string;
  email: string;
  message: string;
};

export type ContactParseResult =
  | { kind: "bot" }
  | { kind: "invalid"; errors: Partial<ContactFormValues>; values: ContactFormValues }
  | { kind: "valid"; value: ContactFormValues };

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f-\u009f]/;
const CONTENT_CONTROL_CHARACTER_PATTERN =
  /[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/;
const EMAIL_LOCAL_PART_PATTERN =
  /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;

function textLength(value: string) {
  return Array.from(value).length;
}

function hasLength(value: string, minimum: number, maximum: number) {
  const length = textLength(value);
  return length >= minimum && length <= maximum;
}

function readText(formData: FormData, name: string) {
  const entries = formData.getAll(name);
  if (entries.length !== 1 || typeof entries[0] !== "string") {
    return "";
  }

  return entries[0];
}

function isBasicEmail(value: string) {
  if (!hasLength(value, 3, 254) || /\s/u.test(value)) {
    return false;
  }

  const parts = value.split("@");
  if (parts.length !== 2) {
    return false;
  }

  const [local, domain] = parts;
  if (!local || !domain || !EMAIL_LOCAL_PART_PATTERN.test(local)) {
    return false;
  }

  return domain.split(".").every(
    (label) =>
      label.length <= 63 &&
      /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(label),
  );
}

export function parseContactForm(formData: FormData): ContactParseResult {
  const website = readText(formData, "website").trim();
  if (website !== "") {
    return { kind: "bot" };
  }

  const values: ContactFormValues = {
    name: readText(formData, "name").trim(),
    email: readText(formData, "email").trim(),
    message: readText(formData, "message").replace(/\r\n/g, "\n").trim(),
  };

  const errors: Partial<ContactFormValues> = {};

  if (CONTROL_CHARACTER_PATTERN.test(values.name)) {
    errors.name = "Удалите недопустимые управляющие символы";
  } else if (!hasLength(values.name, 2, 80)) {
    errors.name = "Введите имя от 2 до 80 символов";
  }

  if (CONTROL_CHARACTER_PATTERN.test(values.email) || !isBasicEmail(values.email)) {
    errors.email = "Введите корректный email";
  }

  if (CONTENT_CONTROL_CHARACTER_PATTERN.test(values.message)) {
    errors.message = "Удалите недопустимые управляющие символы";
  } else if (!hasLength(values.message, 10, 4000)) {
    errors.message = "Напишите сообщение от 10 до 4000 символов";
  }

  if (Object.keys(errors).length > 0) {
    return { kind: "invalid", errors, values };
  }

  return { kind: "valid", value: values };
}
