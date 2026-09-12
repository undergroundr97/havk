import { TestBed } from '@angular/core/testing';

import { AuthenticatedUser } from './auth.models';
import { AuthSessionStore } from './auth-session.store';

describe('AuthSessionStore', () => {
  const user: AuthenticatedUser = {
    id: 'user-1',
    name: 'Criadora HAVK',
    email: 'creator@example.com',
    status: 'ACTIVE',
    createdAt: '2026-07-22T12:00:00Z',
    updatedAt: '2026-07-22T12:00:00Z',
  };

  it('keeps the whole session in one signal and derives authentication', () => {
    const store = TestBed.inject(AuthSessionStore);

    expect(store.session().status).toBe('idle');
    expect(store.isAuthenticated()).toBe(false);

    store.authenticated(user);
    expect(store.session()).toEqual({ status: 'authenticated', user, message: null });
    expect(store.isAuthenticated()).toBe(true);

    store.anonymous();
    expect(store.user()).toBeNull();
    expect(store.isAuthenticated()).toBe(false);
  });
});
