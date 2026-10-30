import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function newConversation(page: Page) {
  const previousUrl = page.url();
  await page.getByRole('button', { name: '+ New conversation', exact: true }).click();
  await expect(page).toHaveURL(/\/chats\/[0-9a-f-]+$/);
  await expect(page).not.toHaveURL(previousUrl);
  await expect(page.getByRole('textbox', { name: 'Your message' })).toBeEnabled();
}

async function send(page: Page, content: string) {
  await page.getByRole('textbox', { name: 'Your message' }).fill(content);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
}

test.beforeEach(async ({ page }) => {
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === 'images.example.test') {
      await route.fulfill({
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="silver"/></svg>',
      });
    } else if (url.hostname === '127.0.0.1') {
      await route.continue();
    } else {
      await route.abort();
    }
  });
  await page.goto('/');
});

test('discovers products, persists rendered cards on reload and continues the conversation', async ({
  page,
}) => {
  await newConversation(page);
  await send(page, 'Find phones');
  await expect(page.getByRole('heading', { name: 'Budget Phone', exact: true })).toBeVisible();
  await expect(
    page.getByText('A useful budget phone for everyday use.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('$99.00', { exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Budget Phone', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Budget Phone', exact: true })).toBeVisible();
  await send(page, 'Anything cheaper?');
  await expect(
    page.getByText('No products matched your criteria.', { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Your message', exact: true })).toHaveCount(1);
  await expect(page.getByRole('article', { name: 'Your message', exact: true })).toHaveCount(2);
});

test('creates a separate conversation and resumes the older one from the sidebar', async ({
  page,
}) => {
  await newConversation(page);
  const oldUrl = page.url();
  await send(page, 'Find phones');
  await expect(page.getByRole('heading', { name: 'Budget Phone', exact: true })).toBeVisible();
  await newConversation(page);
  await send(page, 'Something cheap and cool');
  await expect(
    page.getByText('What product type are you looking for?', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Conversations', exact: true })
    .locator(`a[href="${new URL(oldUrl).pathname}"]`)
    .click();
  await expect(page).toHaveURL(oldUrl);
  await expect(page.getByRole('heading', { name: 'Budget Phone', exact: true })).toBeVisible();
  await expect(
    page.getByText('What product type are you looking for?', { exact: true }),
  ).toHaveCount(0);
});

test('clarifies ambiguous input, explains off-catalog requests and renders multiple product groups', async ({
  page,
}) => {
  await newConversation(page);
  await send(page, 'Something cheap and cool');
  await expect(
    page.getByText('What product type are you looking for?', { exact: true }),
  ).toBeVisible();
  await send(page, 'Book a flight to Tokyo');
  await expect(
    page.getByText('I can help with catalog products, but cannot book flights.', { exact: true }),
  ).toBeVisible();
  await send(page, 'Find phones and fragrances');
  await expect(page.getByRole('region', { name: 'Phones', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Fragrances', exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Everyday Fragrance', exact: true }),
  ).toBeVisible();
});

test('retries a failed response without duplicating the user message', async ({ page }) => {
  await newConversation(page);
  await send(page, 'Retry phones');
  await expect(
    page.getByText('The AI service took too long to respond. Please retry.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Retry this message', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Budget Phone', exact: true })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Your message', exact: true })).toHaveCount(1);
  await expect(
    page.getByText('The AI service took too long to respond. Please retry.', { exact: true }),
  ).toHaveCount(0);
});

test('switches conversations while a response is pending without showing it in the wrong chat', async ({
  page,
}) => {
  await newConversation(page);
  const pendingUrl = page.url();
  await send(page, 'Slow phones');
  await expect(page.getByRole('status')).toHaveText('Preparing your response…');
  await newConversation(page);
  await expect(page.getByText('What are you looking for?', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Budget Phone', exact: true })).toHaveCount(0);
  await page.goto(pendingUrl);
  await expect(page.getByRole('heading', { name: 'Budget Phone', exact: true })).toBeVisible();
});

test('recovers a failed network send while preserving a retryable composer', async ({ page }) => {
  await newConversation(page);
  await page.route('**/api/conversations/*/messages', (route) => route.abort());
  await send(page, 'Find phones');
  await expect(
    page.getByText('Unable to reach the service. Please check your connection and retry.', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Your message' })).toBeEnabled();
  await page.unroute('**/api/conversations/*/messages');
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Budget Phone', exact: true })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Your message', exact: true })).toHaveCount(1);
});

test('shows an actionable error for an unknown conversation', async ({ page }) => {
  await page.goto('/chats/212d9510-58ef-4739-a379-75309fc68fb7');
  await expect(
    page.getByText('This conversation no longer exists.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Your message' })).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: 'Back to conversations', exact: true }),
  ).toBeVisible();
});
