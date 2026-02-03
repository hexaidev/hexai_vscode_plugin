export class HexAIError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'HexAIError';
  }
}

export class ConnectionError extends HexAIError {
  constructor(message: string = 'Connection failed') {
    super(message, undefined, 'CONNECTION_ERROR');
    this.name = 'ConnectionError';
  }
}

export class AuthError extends HexAIError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401, 'AUTH_ERROR');
    this.name = 'AuthError';
  }
}

export class ValidationError extends HexAIError {
  constructor(message: string, public readonly field?: string) {
    super(message, 422, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends HexAIError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}
