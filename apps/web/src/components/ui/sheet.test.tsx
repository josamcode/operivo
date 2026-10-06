import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Sheet, SheetContent, SheetTitle } from './sheet';

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1600 });
  window.matchMedia = ((q: string) => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {} })) as never;
});
afterEach(() => localStorage.clear());

function renderSheet() {
  return render(
    <Sheet open>
      <SheetContent side="right" resizable={{ id: 'test', defaultWidth: 560, minWidth: 400, maxWidth: 900 }}>
        <SheetTitle>Details</SheetTitle>
      </SheetContent>
    </Sheet>,
  );
}

const sheetEl = () => document.querySelector<HTMLElement>('[data-slot="sheet-content"]')!;

describe('resizable side sheet', () => {
  it('starts at the default width and resizes from the keyboard within its limits', async () => {
    renderSheet();
    const handle = await screen.findByRole('separator', { name: 'Resize panel' });
    expect(sheetEl().style.width).toBe('560px');

    fireEvent.keyDown(handle, { key: 'ArrowLeft' }); // toward the page → wider
    expect(sheetEl().style.width).toBe('592px');
    fireEvent.keyDown(handle, { key: 'ArrowRight', shiftKey: true }); // narrower
    expect(sheetEl().style.width).toBe('496px');

    for (let i = 0; i < 10; i++) fireEvent.keyDown(handle, { key: 'ArrowRight', shiftKey: true });
    expect(sheetEl().style.width).toBe('400px'); // min
    for (let i = 0; i < 20; i++) fireEvent.keyDown(handle, { key: 'ArrowLeft', shiftKey: true });
    expect(sheetEl().style.width).toBe('900px'); // max
  });

  it('remembers the width and resets on double-click', async () => {
    const first = renderSheet();
    const handle = await screen.findByRole('separator');
    fireEvent.keyDown(handle, { key: 'ArrowLeft', shiftKey: true });
    expect(localStorage.getItem('opervio-width:test')).toBe('656');
    first.unmount();

    renderSheet();
    expect(sheetEl().style.width).toBe('656px');
    fireEvent.doubleClick(await screen.findByRole('separator'));
    expect(sheetEl().style.width).toBe('560px');
    expect(localStorage.getItem('opervio-width:test')).toBeNull();
  });

  it('drags the inner edge: moving left widens a right-side sheet', async () => {
    renderSheet();
    const handle = await screen.findByRole('separator');
    fireEvent.pointerDown(handle, { button: 0, clientX: 1040, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 940, pointerId: 1 });
    expect(sheetEl().style.width).toBe('660px');
    fireEvent.pointerMove(handle, { clientX: 1140, pointerId: 1 });
    expect(sheetEl().style.width).toBe('460px');
    fireEvent.pointerUp(handle, { pointerId: 1 });
    expect(localStorage.getItem('opervio-width:test')).toBe('460');
  });
});
