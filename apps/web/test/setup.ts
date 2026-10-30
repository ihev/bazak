import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(cleanup);
// Scrolling is a browser behavior, not implemented by jsdom.
Element.prototype.scrollIntoView = () => {};
