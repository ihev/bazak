import { HttpException } from '@nestjs/common';
import { DependencyUnavailableException } from '../common/http/dependency-unavailable.exception.js';

export function databaseOperation<T>(operation: () => T): T {
  try {
    return operation();
  } catch (error) {
    if (error instanceof HttpException) throw error;
    throw new DependencyUnavailableException(
      'storage',
      'Conversation storage is unavailable. Please try again.',
      error,
    );
  }
}
