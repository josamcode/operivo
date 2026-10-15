import { expect, test, type Page } from '@playwright/test';

const WIDTHS = [320, 375, 390, 430, 768, 1024, 1440, 1920];

/** Sections below the hero mount progressively after first paint; the footer arrives last. */
async function gotoReady(page: Page, path = '/') {
  await page.goto(path);
  await page.locator('footer').waitFor();
}

/** Scroll the whole page so every reveal animation and lazy image has run. */
async function scrollThrough(page: Page) {
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  const step = await page.evaluate(() => Math.round(innerHeight * 0.6));
  for (let y = 0; y <= total; y += step) {
    await page.evaluate((y) => window.scrollTo(0, y), y);
    await page.waitForTimeout(60);
  }
  await page.waitForLoadState('networkidle');
}

async function centeredMember(page: Page) {
  return page.evaluate(() => {
    const t = document.querySelector<HTMLElement>('[aria-roledescription=carousel]')!;
    const mid = t.scrollLeft + t.clientWidth / 2;
    let best = { d: Infinity, id: '' };
    t.querySelectorAll<HTMLElement>('[data-member]').forEach((el) => {
      const d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - mid);
      if (d < best.d) best = { d, id: el.dataset.member! };
    });
    return best.id;
  });
}

test('loads cleanly: no console errors, no failed requests, every image decodes', async ({ page }) => {
  const errors: string[] = [];
  const failed: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('response', (r) => r.status() >= 400 && failed.push(`${r.status()} ${r.url()}`));
  page.on('requestfailed', (r) => failed.push(`failed ${r.url()}`));

  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoReady(page);
  await expect(page).toHaveTitle(/Opervio/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText("You're the founder.");
  await scrollThrough(page);

  // Lazy images off to the side of the carousel never load on their own — load and decode every one.
  const broken = await page.evaluate(async () => {
    const imgs = [...document.images];
    imgs.forEach((i) => (i.loading = 'eager'));
    await Promise.all(imgs.map((i) => i.decode().catch(() => null)));
    return imgs.filter((i) => i.naturalWidth === 0).map((i) => i.currentSrc || i.src);
  });
  expect(broken).toEqual([]);
  expect(errors).toEqual([]);
  expect(failed).toEqual([]);
});

test('every in-page link points at a section that exists', async ({ page }) => {
  await gotoReady(page);
  const missing = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')]
      .map((a) => a.getAttribute('href')!)
      .filter((h) => h.length > 1 && !document.getElementById(h.slice(1))),
  );
  expect(missing).toEqual([]);
});

test('desktop nav scrolls to sections; AI team menu opens and focuses a member', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Primary' });

  for (const [label, id] of [
    ['Workflows', 'workflows'],
    ['How it works', 'how-it-works'],
    ['Features', 'features'],
  ] as const) {
    await nav.getByRole('link', { name: label }).click();
    await expect(page).toHaveURL(new RegExp(`#${id}$`));
    await expect(page.locator(`#${id}`)).toBeInViewport();
  }

  await nav.getByRole('link', { name: 'Get Opervio' }).click();
  await expect(page.locator('#get-started')).toBeInViewport();

  const menuButton = nav.getByRole('button', { name: 'AI team' });
  await menuButton.click();
  await expect(menuButton).toHaveAttribute('aria-expanded', 'true');
  const items = page.locator('nav[aria-label="Primary"] ul a');
  await expect(items).toHaveCount(7);
  await items.filter({ hasText: 'Omar' }).click();
  await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#team')).toBeInViewport();
  await expect.poll(() => centeredMember(page), { timeout: 5000 }).toBe('omar');

  await menuButton.click();
  await page.keyboard.press('Escape');
  await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
});

test('a nav click right after load still reaches its section', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Features' }).click();
  await expect(page.locator('#features')).toBeInViewport({ timeout: 5000 });
});

test('team carousel starts on Noor and loops with the arrow buttons', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#team');
  await expect.poll(() => centeredMember(page)).toBe('noor');
  await page.getByRole('button', { name: 'Next team member' }).click();
  await expect.poll(() => centeredMember(page)).toBe('youssef');
  await page.getByRole('button', { name: 'Previous team member' }).click();
  await page.getByRole('button', { name: 'Previous team member' }).click();
  await expect.poll(() => centeredMember(page)).toBe('prompt');
});

test('how-it-works steps are selectable', async ({ page }) => {
  await page.goto('/#how-it-works');
  const step = page.getByRole('button', { name: 'Watch the work happen' });
  await step.click();
  await expect(step).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText('The Result Judge checks every result before it counts.')).toBeVisible();
});

test('copy button copies the setup commands', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/#get-started');
  await page.getByRole('button', { name: 'Copy' }).click();
  await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible();
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text.replace(/\r\n/g, '\n')).toBe('pnpm install\npnpm db:up\npnpm db:migrate\npnpm app');
});

test('mobile menu opens, navigates and closes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeHidden();
  await page.getByRole('button', { name: 'Open menu' }).click();
  const dialog = page.getByRole('dialog', { name: 'Menu' });
  await expect(dialog).toBeVisible();
  // The overlay must cover the screen (a backdrop-filter ancestor once collapsed it to the header).
  expect((await dialog.boundingBox())!.height).toBeGreaterThan(600);
  await dialog.getByRole('link', { name: 'How it works' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('#how-it-works')).toBeInViewport();
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Menu' })).toBeHidden();
});

for (const width of WIDTHS) {
  test(`no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await gotoReady(page);
    await scrollThrough(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    // Primary CTA reachable at every size.
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.getByRole('link', { name: 'Get Opervio' }).first()).toBeVisible();
  });
}

test('skip link is the first tab stop and jumps to main content', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await expect(skip).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#main$/);
});

test('content is visible with reduced motion', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4180/');
  await page.locator('footer').waitFor();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.locator('#features').scrollIntoViewIfNeeded();
  await expect(page.getByRole('heading', { name: 'Built to run your business' })).toBeVisible();
  await context.close();
});
