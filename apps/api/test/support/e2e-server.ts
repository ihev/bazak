import 'reflect-metadata';
import { createApp } from '../../dist/create-app.js';
import { createTestEnvironment } from './test-environment.js';
import { UpstreamFixture } from './upstream-fixture.js';

const port = Number(process.env.E2E_API_PORT ?? 39101);
const environment = createTestEnvironment();
const fixture = new UpstreamFixture();
globalThis.fetch = fixture.fetch;
process.once('exit', () => environment.cleanup());

const app = await createApp();
await app.listen(port, '127.0.0.1');
console.info(`Isolated E2E API ready on port ${port}. External requests are intercepted.`);
