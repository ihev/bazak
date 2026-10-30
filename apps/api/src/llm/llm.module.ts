import { Module } from '@nestjs/common';
import { AppConfigModule } from '../config/app-config.module.js';
import { LlmManager } from './llm-manager.service.js';

@Module({ imports: [AppConfigModule], providers: [LlmManager], exports: [LlmManager] })
export class LlmModule {}
