import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useResizableWidth } from '@/hooks/use-resizable-width';
import { ResizeHandle } from './resize-handle';

function DockedPanel() {
  const size = useResizableWidth({ id: 'noor', defaultWidth: 400, minWidth: 340, maxWidth: 820, reserve: 800 });
  return (
    <aside data-testid="panel" style={{ width: size.width }}>
      <ResizeHandle side="right" size={size} />
    </aside>
  );
}

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
});

describe('docked panel resizing', () => {
  it('never squeezes the page: width is capped by the space reserved for sidebar + page', () => {
    render(<DockedPanel />);
    const handle = screen.getByRole('separator', { name: 'Resize panel' });
    fireEvent.pointerDown(handle, { button: 0, clientX: 1040, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 200, pointerId: 1 }); // drag far into the page
    fireEvent.pointerUp(handle, { pointerId: 1 });
    expect(screen.getByTestId('panel').style.width).toBe('640px'); // 1440 − 800 reserved
    fireEvent.pointerDown(handle, { button: 0, clientX: 800, pointerId: 2 });
    fireEvent.pointerMove(handle, { clientX: 1430, pointerId: 2 }); // drag far right
    fireEvent.pointerUp(handle, { pointerId: 2 });
    expect(screen.getByTestId('panel').style.width).toBe('340px'); // min
    expect(localStorage.getItem('opervio-width:noor')).toBe('340');
  });

  it('re-fits when the window gets smaller', () => {
    localStorage.setItem('opervio-width:noor', '640');
    render(<DockedPanel />);
    expect(screen.getByTestId('panel').style.width).toBe('640px');
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
    fireEvent(window, new Event('resize'));
    expect(screen.getByTestId('panel').style.width).toBe('480px');
  });
});
