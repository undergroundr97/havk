import { Component, inject, OnInit, output } from '@angular/core';
import { PlatformAccountContextStore } from '../../data-access/platform-account-context.store';

@Component({
  selector: 'app-platform-account-selector', standalone: true,
  templateUrl: './platform-account-selector.html', styleUrl: './platform-account-selector.scss',
})
export class PlatformAccountSelector implements OnInit {
  protected readonly context = inject(PlatformAccountContextStore);
  readonly changed = output<string | null>();
  async ngOnInit(): Promise<void> { await this.context.load(); }
  protected select(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (!value) { this.context.clear(); this.changed.emit(null); return; }
    this.context.select(value); this.changed.emit(value);
  }
}
