// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { usePushNotifications } from "@/hooks/usePushNotifications";

const mocks = vi.hoisted(() => ({
  maybeSingle: vi.fn(), upsert: vi.fn(), eq: vi.fn(), from: vi.fn(), select: vi.fn(),
}));
vi.mock("@/contexts/StudentPortalContext", () => ({ useStudentPortal: () => ({ student: { id: "aluno-atual" } }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const requestPermission = vi.fn();
const getSubscription = vi.fn();
const getRegistration = vi.fn();
const register = vi.fn();
const sub = { endpoint: "https://push.test/device", toJSON: () => ({ endpoint: "https://push.test/device", keys: { p256dh: "public-test", auth: "test" } }) };
const registration = { pushManager: { getSubscription, subscribe: vi.fn().mockResolvedValue(sub) } };
let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; }

beforeEach(() => {
  vi.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  Object.defineProperty(window, "Notification", { configurable: true, value: { permission: "granted", requestPermission } });
  Object.defineProperty(window, "PushManager", { configurable: true, value: class {} });
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: { getRegistration, register, ready: Promise.resolve(registration) } });
  getRegistration.mockResolvedValue(registration); register.mockResolvedValue(registration);
  getSubscription.mockResolvedValue(sub); requestPermission.mockResolvedValue("granted");
  mocks.from.mockReturnValue({ select: mocks.select, upsert: mocks.upsert });
  mocks.select.mockReturnValue({ eq: mocks.eq });
  mocks.eq.mockReturnValue({ eq: mocks.eq, maybeSingle: mocks.maybeSingle });
  mocks.maybeSingle.mockResolvedValue({ data: { id: "inscricao" }, error: null });
  mocks.upsert.mockResolvedValue({ error: null });
});
afterEach(() => { cleanup(); client.clear(); });

describe("inscrição push vinculada ao aparelho e aluno", () => {
  it("confirma tanto a inscrição local quanto o vínculo do aluno no servidor", async () => {
    const { result } = renderHook(usePushNotifications, { wrapper });
    await waitFor(() => expect(result.current.isSubscribed).toBe(true));
    expect(mocks.eq).toHaveBeenCalledWith("endpoint", sub.endpoint);
    expect(mocks.eq).toHaveBeenCalledWith("aluno_id", "aluno-atual");
    expect(register).not.toHaveBeenCalled();
  });
  it("não considera ativo só porque outro aparelho ou aluno tem push", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    const { result } = renderHook(usePushNotifications, { wrapper });
    await waitFor(() => expect(result.current.isChecking).toBe(false));
    expect(result.current.isSubscribed).toBe(false);
  });
  it("solicita permissão no clique antes de registrar e atualiza todas as instâncias", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    const { result } = renderHook(() => ({ a: usePushNotifications(), b: usePushNotifications() }), { wrapper });
    await waitFor(() => expect(result.current.a.isChecking).toBe(false));
    await act(async () => { await result.current.a.subscribe(); });
    expect(requestPermission.mock.invocationCallOrder[0]).toBeLessThan(register.mock.invocationCallOrder[0]);
    await waitFor(() => expect(result.current.b.isSubscribed).toBe(true));
    expect(mocks.upsert).toHaveBeenCalledOnce();
  });
  it("não pede novamente nem registra worker com permissão bloqueada", async () => {
    Object.defineProperty(window, "Notification", { configurable: true, value: { permission: "denied", requestPermission } });
    const { result } = renderHook(usePushNotifications, { wrapper });
    await act(async () => { await result.current.subscribe(); });
    expect(requestPermission).not.toHaveBeenCalled();
    expect(register).not.toHaveBeenCalled();
  });
});
