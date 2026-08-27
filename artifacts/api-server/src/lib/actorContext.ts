import { AsyncLocalStorage } from "node:async_hooks";

/**
 * WHO is acting in the current request (Instruction #28, Ring 1).
 * Set once by the admin gate; read by the changelog and any auditing code.
 * The owner never impersonates a host — owner requests stay 'owner' even
 * inside a tenant, which is what the changelog attribution relies on.
 */
export type Actor =
  | { kind: "owner"; requestIp?: string | null }
  | { kind: "host"; hostUserId: string; tenantId: string; requestIp?: string | null };

export const actorStorage = new AsyncLocalStorage<Actor>();

export function currentActor(): Actor | undefined {
  return actorStorage.getStore();
}
