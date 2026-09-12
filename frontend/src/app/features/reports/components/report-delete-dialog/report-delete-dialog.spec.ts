import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ReportDeleteDialog } from './report-delete-dialog';

describe('ReportDeleteDialog', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ReportDeleteDialog] });
  });

  it('has an accessible name and description and contains keyboard focus', async () => {
    const fixture = TestBed.createComponent(ReportDeleteDialog);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('reportTitle', 'Relatório longo');
    fixture.detectChanges();
    await Promise.resolve();

    const host = fixture.nativeElement as HTMLElement;
    const dialog = host.querySelector<HTMLElement>('[role="dialog"]');
    const buttons = host.querySelectorAll<HTMLButtonElement>('button');
    expect(dialog?.getAttribute('aria-labelledby')).toBe('delete-dialog-title');
    expect(dialog?.getAttribute('aria-describedby')).toBe('delete-dialog-description');
    expect(dialog?.textContent).toContain('Relatório longo');
    expect(document.activeElement).toBe(buttons[0]);

    buttons[1]?.focus();
    dialog?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(document.activeElement).toBe(buttons[0]);

    buttons[0]?.focus();
    dialog?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }),
    );
    expect(document.activeElement).toBe(buttons[1]);
  });

  it('announces progress and disables every action while deletion is running', () => {
    const fixture = TestBed.createComponent(ReportDeleteDialog);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('deleting', true);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('[role="status"]')?.textContent).toContain('Excluindo relatório');
    expect(
      Array.from(host.querySelectorAll<HTMLButtonElement>('button')).every(
        (button) => button.disabled,
      ),
    ).toBe(true);
  });

  it('emits cancellation on Escape but never while a deletion is running', () => {
    const fixture = TestBed.createComponent(ReportDeleteDialog);
    const cancelled = vi.fn();
    fixture.componentInstance.cancelled.subscribe(cancelled);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    const dialog = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      '[role="dialog"]',
    );

    dialog?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(cancelled).toHaveBeenCalledOnce();

    fixture.componentRef.setInput('deleting', true);
    fixture.detectChanges();
    dialog?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(cancelled).toHaveBeenCalledOnce();
  });
});
