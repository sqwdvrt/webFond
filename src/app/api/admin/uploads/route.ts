import { getAdminSession } from "@/lib/admin-auth/session";
import {
  inspectUpload,
  parseUploadKind,
  UploadValidationError,
} from "@/features/uploads/validate";
import {
  storeUpload,
  UploadStorageUnavailableError,
} from "@/features/uploads/store";

const PRIVACY_HEADERS = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

const BODY_LIMIT = 4_200_000;

type UploadRouteDependencies = {
  getSession: () => Promise<unknown>;
  store: typeof storeUpload;
  readFormData?: (request: Request) => Promise<FormData>;
};

const defaultDependencies: UploadRouteDependencies = {
  getSession: getAdminSession,
  store: storeUpload,
};

function jsonResponse(
  status: number,
  body: Record<string, unknown>,
  extraHeaders: HeadersInit = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...PRIVACY_HEADERS,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("Origin");
  if (!origin) {
    return false;
  }

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function handleAdminUpload(
  request: Request,
  dependencies: UploadRouteDependencies = defaultDependencies,
) {
  if (request.method !== "POST") {
    return jsonResponse(405, { error: "method_not_allowed" });
  }

  if (!sameOrigin(request)) {
    return jsonResponse(403, { error: "forbidden" });
  }

  const session = await dependencies.getSession();
  if (!session) {
    return jsonResponse(401, { error: "unauthorized" });
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > BODY_LIMIT) {
    return jsonResponse(413, { error: "too_large" });
  }

  let formData: FormData;
  try {
    formData = await (dependencies.readFormData ?? ((current) => current.formData()))(
      request,
    );
  } catch {
    return jsonResponse(400, { error: "invalid" });
  }

  const kind = parseUploadKind(formData.get("kind"));
  const file = formData.get("file");

  if (!kind || !(file instanceof File)) {
    return jsonResponse(400, { error: "invalid" });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  try {
    const detected = inspectUpload(bytes, kind);
    const stored = await dependencies.store({ bytes, detected, kind });
    return jsonResponse(200, { url: stored.url });
  } catch (error) {
    if (error instanceof UploadValidationError) {
      return jsonResponse(400, { error: "invalid", message: error.message });
    }

    if (error instanceof UploadStorageUnavailableError) {
      return jsonResponse(503, {
        error: "storage_unavailable",
        message: "Загрузка на сервере не настроена. Вставьте ссылку вручную.",
      });
    }

    return jsonResponse(500, { error: "failed" });
  }
}

export async function POST(request: Request) {
  return handleAdminUpload(request);
}
