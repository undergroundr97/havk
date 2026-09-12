import { DOCUMENT } from '@angular/common';
import {
  Component,
  effect,
  ElementRef,
  inject,
  input,
  output,
  viewChild,
  viewChildren,
} from '@angular/core';

@Component({
  selector: 'app-report-delete-dialog',
  standalone: true,
  templateUrl: './report-delete-dialog.html',
  styleUrl: './report-delete-dialog.scss',
})
export class ReportDeleteDialog {
  readonly open = input(false);
  readonly reportTitle = input('');
  readonly deleting = input(false);
  readonly errorMessage = input<string | null>(null);
  readonly canRetry = input(true);
  readonly cancelled = output<void>();
  readonly confirmed = output<void>();

  private readonly document = inject(DOCUMENT);
  private readonly panel = viewChild<ElementRef<HTMLElement>>('dialogPanel');
  private readonly cancelButton = viewChild<ElementRef<HTMLButtonElement>>('cancelButton');
  private readonly dialogActions = viewChildren<ElementRef<HTMLButtonElement>>('dialogAction');
  private previousFocus: HTMLElement | null = null;
  private wasOpen = false;
  private focusedCurrentOpen = false;

  private readonly manageFocus = effect(() => {
    const open = this.open();
    const deleting = this.deleting();
    const panel = this.panel()?.nativeElement;
    const cancelButton = this.cancelButton()?.nativeElement;

    if (open && !this.wasOpen) {
      this.previousFocus =
        this.document.activeElement instanceof HTMLElement ? this.document.activeElement : null;
    }
    if (open && panel && !this.focusedCurrentOpen) {
      this.focusedCurrentOpen = true;
      queueMicrotask(() => (cancelButton ?? panel).focus());
    }
    if (open && deleting && panel) {
      queueMicrotask(() => panel.focus());
    }
    if (!open) {
      this.focusedCurrentOpen = false;
    }
    this.wasOpen = open;
  });

  protected cancel(): void {
    if (this.deleting()) return;
    this.cancelled.emit();
    const previousFocus = this.previousFocus;
    queueMicrotask(() => {
      if (previousFocus?.isConnected) previousFocus.focus();
    });
  }

  protected confirm(): void {
    if (!this.deleting() && (this.errorMessage() === null || this.canRetry())) {
      this.confirmed.emit();
    }
  }

  protected handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.cancel();
      return;
    }
    if (event.key !== 'Tab') return;

    const actions = this.dialogActions()
      .map((action) => action.nativeElement)
      .filter((action) => !action.disabled);
    if (actions.length === 0) {
      event.preventDefault();
      this.panel()?.nativeElement.focus();
      return;
    }

    const first = actions[0];
    const last = actions.at(-1);
    if (event.shiftKey && this.document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && this.document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
}
