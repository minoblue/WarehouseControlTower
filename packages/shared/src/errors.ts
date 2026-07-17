export class DomainError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 409,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Unknown error';
