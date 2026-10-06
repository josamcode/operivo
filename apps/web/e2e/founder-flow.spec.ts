import { expect, test } from '@playwright/test';

test('founder setup → Noor plan → pages → agent works → verified output on the page', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation');

  // First-run setup: quick and conversational.
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('textbox').fill('Gerges');
  await page.keyboard.press('Enter');
  await page.getByRole('textbox').fill('Freelance full-stack developer.');
  await page.keyboard.press('Enter');
  await page.getByRole('textbox').fill('I want help getting clients, creating content, learning AI and staying consistent with fitness.');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: '3–4 hours' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Skip' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Meet Noor' }).click();

  // Noor proposes a structure; nothing is created before confirmation.
  const noor = page.getByRole('complementary', { name: 'Noor' });
  await expect(noor.getByText('Main focus')).toBeVisible({ timeout: 30_000 });
  await expect(nav.getByRole('link', { name: 'Clients' })).toHaveCount(0);
  await noor.getByRole('button', { name: 'Confirm and start' }).click();

  // Pages appear in the sidebar, the specialist starts.
  await expect(nav.getByRole('link', { name: 'Clients' })).toBeVisible({ timeout: 15_000 });
  await expect(nav.getByRole('link', { name: 'Learning' })).toBeVisible();

  // The agent works through the real MCP tools; the judge verifies; Home shows it.
  const team = page.locator('section', { has: page.getByRole('heading', { name: 'Team' }) });
  await expect(team.getByText('Youssef')).toBeVisible({ timeout: 30_000 });
  await expect(team.getByText('Done')).toBeVisible({ timeout: 45_000 });
  await expect(page.getByRole('main').getByText('Call one past client')).toBeVisible();

  // The relevant page updated from structured records.
  await nav.getByRole('link', { name: 'Clients' }).click();
  await expect(page.getByRole('heading', { name: 'Clients', level: 1 })).toBeVisible();
  await expect(page.getByText('Acme Clinic').first()).toBeVisible();
  await expect(page.getByText('First leads').first()).toBeVisible();

  // The effective prompt is inspectable.
  await page.getByRole('button', { name: /Youssef/ }).first().click();
  await page.getByRole('button', { name: 'View effective prompt' }).click();
  const dialog = page.getByRole('dialog', { name: 'Effective prompt' });
  await expect(dialog.getByText('Success criteria (the judge checks these)')).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Objective' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');

  // Outputs and the command palette.
  await nav.getByRole('link', { name: 'Outputs' }).click();
  await expect(page.getByRole('main').getByText('First leads').first()).toBeVisible();
  await page.keyboard.press('Control+k');
  await expect(page.getByPlaceholder('Ask Noor, open a page, find an output…')).toBeVisible();
  await expect(page.getByRole('option', { name: /Clients/ })).toBeVisible();
});
