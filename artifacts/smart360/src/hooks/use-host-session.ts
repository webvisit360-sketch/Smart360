import { useQuery } from "@tanstack/react-query";
import type { ManagementMode } from "../lib/tenant-permissions";

export type HostSession = {
  authenticated: boolean;
  email?: string;
  tenantId?: string;
  onboardingRequired?: boolean;
  managementMode?: ManagementMode;
};

export function useHostSession() {
  // No generated session hook exists. Share the result between the shell and editors.
  return useQuery<HostSession>({
    queryKey: ["host-session"],
    queryFn: async () => {
      const response = await fetch("/api/admin/host/session", { credentials: "include", cache: "no-store" });
      if (response.status === 401) return { authenticated: false };
      if (!response.ok) throw new Error("Seje gostitelja ni bilo mogoče preveriti.");
      return response.json();
    },
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchInterval: 15_000,
    retry: false,
  });
}