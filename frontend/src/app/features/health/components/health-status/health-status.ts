import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { take } from 'rxjs';

import { HealthCheckResponse } from '../../data-access/health-check.model';
import { HealthCheckService } from '../../data-access/health-check.service';

type HealthCheckState = 'idle' | 'loading' | 'success' | 'error';

@Component({
  selector: 'app-health-status',
  standalone: true,
  templateUrl: './health-status.html',
  styleUrl: './health-status.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HealthStatus implements OnInit {
  private readonly healthCheckService = inject(HealthCheckService);
  private readonly destroyRef = inject(DestroyRef);

  readonly state = signal<HealthCheckState>('idle');
  readonly health = signal<HealthCheckResponse | null>(null);

  ngOnInit(): void {
    this.check();
  }

  protected check(): void {
    this.state.set('loading');
    this.health.set(null);

    this.healthCheckService
      .check()
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (health) => {
          this.health.set(health);
          this.state.set('success');
        },
        error: () => this.state.set('error'),
      });
  }
}
