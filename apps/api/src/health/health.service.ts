import { HealthResponse } from '@bazak/contracts';
import { Injectable } from '@nestjs/common';
import { DependencyUnavailableException } from '../common/http/dependency-unavailable.exception.js';
import { DatabaseHealthRepository } from '../database/database-health.repository.js';

@Injectable()
export class HealthService {
  constructor(private readonly repository: DatabaseHealthRepository) {}

  getStatus(): HealthResponse {
    try {
      this.repository.assertReadable();
    } catch (error) {
      throw new DependencyUnavailableException(
        'storage',
        'Database unavailable. Check the database and migrations.',
        error,
      );
    }

    return { status: 'ok', database: 'ok' };
  }
}
