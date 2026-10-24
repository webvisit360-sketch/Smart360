/** Dependency-free shared error identity: usable while Creator modules initialize. */
export class CreatorBulkApprovalError extends Error {
  constructor(
    message: string,
    public readonly proposalId?: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }
}
