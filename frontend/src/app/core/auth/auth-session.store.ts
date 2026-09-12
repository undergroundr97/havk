import { computed, Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, Observable, take } from 'rxjs';

import { AuthenticatedUser } from './auth.models';

export type AuthSessionStatus = 'idle' | 'loading' | 'authenticated' | 'anonymous' | 'error';

export interface AuthSessionState {
  readonly status: AuthSessionStatus;
  readonly user: AuthenticatedUser | null;
  readonly message: string | null;
}

@Injectable({ providedIn: 'root' })
export class AuthSessionStore {
  readonly session = signal<AuthSessionState>({
    status: 'idle',
    user: null,
    message: null,
  });
  readonly user = computed(() => this.session().user);
  readonly isAuthenticated = computed(() => this.session().status === 'authenticated');
  private readonly sessionChanges = toObservable(this.session);

  whenSettled(): Observable<AuthSessionState> {
    return this.sessionChanges.pipe(
      filter((state) => state.status !== 'idle' && state.status !== 'loading'),
      take(1),
    );
  }

  loading(): void {
    this.session.set({ status: 'loading', user: this.session().user, message: null });
  }

  authenticated(user: AuthenticatedUser): void {
    this.session.set({ status: 'authenticated', user, message: null });
  }

  anonymous(): void {
    this.session.set({ status: 'anonymous', user: null, message: null });
  }

  failed(message: string): void {
    this.session.set({ status: 'error', user: null, message });
  }
}
