import { HealthResponse } from '@bazak/contracts';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseHealthRepository } from '../database/database-health.repository.js';

@Injectable()
export class HealthService {
  constructor(private readonly repository: DatabaseHealthRepository) {}

  getStatus(): HealthResponse {
    try {
      this.repository.assertReadable();
    } catch {
      throw new ServiceUnavailableException(
        'Database unavailable. Check the database and migrations.',
      );
    }

    return { status: 'ok', database: 'ok' };
  }
}
