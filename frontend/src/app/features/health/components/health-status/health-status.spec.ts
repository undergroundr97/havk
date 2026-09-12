import { TestBed } from '@angular/core/testing';
import { Observable, of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';

import { HealthCheckResponse } from '../../data-access/health-check.model';
import { HealthCheckService } from '../../data-access/health-check.service';
import { HealthStatus } from './health-status';

describe('HealthStatus', () => {
  const check = vi.fn((): Observable<HealthCheckResponse> => of({ status: 'UP' }));

  beforeEach(() => {
    check.mockReset();
    check.mockReturnValue(of({ status: 'UP' }));
    TestBed.configureTestingModule({
      imports: [HealthStatus],
      providers: [{ provide: HealthCheckService, useValue: { check } }],
    });
  });

  it('starts idle before initialization', () => {
    const fixture = TestBed.createComponent(HealthStatus);

    expect(fixture.componentInstance.state()).toBe('idle');
  });

  it('shows loading while the request is pending', () => {
    const pendingResponse = new Subject<HealthCheckResponse>();
    check.mockReturnValue(pendingResponse);
    const fixture = TestBed.createComponent(HealthStatus);
    fixture.detectChanges();

    expect(fixture.componentInstance.state()).toBe('loading');
    expect(fixture.nativeElement.textContent).toContain('Verificando a disponibilidade');
  });

  it('shows the successful backend status', () => {
    const fixture = TestBed.createComponent(HealthStatus);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Backend disponível — UP');
  });

  it('shows a retry action when the request fails', () => {
    check.mockReturnValue(throwError(() => new Error('offline')));
    const fixture = TestBed.createComponent(HealthStatus);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Não foi possível confirmar');
    expect(element.querySelector('button')?.textContent).toContain('Tentar novamente');
  });
});
