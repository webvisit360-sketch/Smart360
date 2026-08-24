import { useEffect, useState } from "react";

export type HostSession = {
  authenticated: boolean;
  email?: string;
  tenantId?: string;
};

export function useHostSession() {
  const [data, setData] = useState<HostSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/host/session", { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) return { authenticated: false };
        return await response.json() as HostSession;
      })
      .then((session) => {
        if (active) setData(session);
      })
      .catch(() => {
        if (active) setData({ authenticated: false });
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { data, isLoading };
}