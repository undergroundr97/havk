import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { map, Observable } from 'rxjs';

import { AuthSessionState, AuthSessionStore } from './auth-session.store';
import { safeInternalReturnUrl } from './safe-return-url';

export const authenticatedGuard: CanActivateFn = (_route, state) => {
  const store = inject(AuthSessionStore);
  const router = inject(Router);
  return decideAfterRestoration(store, (session) => session.status === 'authenticated'
    ? true
    : router.createUrlTree(['/login'], {
      queryParams: { returnUrl: safeInternalReturnUrl(state.url) },
    }));
};

export const authenticatedUserRedirectGuard: CanActivateFn = () => {
  const store = inject(AuthSessionStore);
  const router = inject(Router);
  return decideAfterRestoration(store, (session) => session.status === 'authenticated'
    ? router.createUrlTree(['/dashboard'])
    : true);
};

function decideAfterRestoration(
  store: AuthSessionStore,
  decide: (session: AuthSessionState) => boolean | UrlTree,
): boolean | UrlTree | Observable<boolean | UrlTree> {
  const current = store.session();
  return current.status === 'idle' || current.status === 'loading'
    ? store.whenSettled().pipe(map(decide))
    : decide(current);
}
