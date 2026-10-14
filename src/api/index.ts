import { QueryClient } from "@tanstack/react-query";
import { ApiClient } from "./client";
import { getFingerprint } from "../auth/fingerprint";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, staleTime: 10_000 },
    mutations: { retry: false },
  },
});

const sessionListeners = new Set<() => void>();

export const subscribeSessionEnd = (listener: () => void) => {
  sessionListeners.add(listener);

  return () => {
    sessionListeners.delete(listener);
  };
};

export const api = new ApiClient(window.location.origin, getFingerprint, () => {
  queryClient.clear();

  sessionListeners.forEach((listener) => listener());
});
