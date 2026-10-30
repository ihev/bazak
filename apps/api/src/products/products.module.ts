import { Module } from '@nestjs/common';
import { DummyJsonClient } from './dummyjson.client.js';
import { ProductSearchService } from './product-search.service.js';

@Module({ providers: [DummyJsonClient, ProductSearchService], exports: [ProductSearchService] })
export class ProductsModule {}
