import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
import { ReconcileDonationsAction } from "./reconcile-action";
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
describe("manual reconciliation UI", () => {
  it("refreshes the current list after checking the selected donation", async () => {
    const fetch = vi.fn(async (...args: [string, RequestInit?]) => { void args; return Response.json({ kind: "succeeded" }); });
    vi.stubGlobal("fetch", fetch);
    render(<ReconcileDonationsAction donationId="donation-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Проверить в ЮKassa" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Оплата подтверждена");
    expect(refresh).toHaveBeenCalledOnce();
    expect(JSON.parse(fetch.mock.calls[0]![1]!.body as string)).toEqual({ mode: "single", donationId: "donation-1" });
  });
  it("explains an expired session without treating it as success", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 401 })));
    render(<ReconcileDonationsAction />);
    fireEvent.click(screen.getByRole("button", { name: "Проверить зависшие" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Сессия истекла");
    expect(refresh).not.toHaveBeenCalled();
  });
});
