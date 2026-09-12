import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { DOCUMENT, inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { AuthSessionStore } from './auth-session.store';
import { isPrivateApplicationUrl, safeInternalReturnUrl } from './safe-return-url';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
let sessionRedirectInProgress = false;

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const document = inject(DOCUMENT);
  const store = inject(AuthSessionStore);
  const router = inject(Router);
  const csrfToken = readCookie(document.cookie, 'XSRF-TOKEN');
  const headers =
    MUTATING_METHODS.has(request.method) && csrfToken
      ? { 'X-XSRF-TOKEN': csrfToken, 'X-CSRF-TOKEN': csrfToken }
      : undefined;
  const authenticatedRequest = request.clone({ withCredentials: true, setHeaders: headers });

  return next(authenticatedRequest).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        store.anonymous();
        if (
          !sessionRedirectInProgress &&
          isPrivateApplicationUrl(router.url) &&
          !request.url.endsWith('/api/auth/logout')
        ) {
          sessionRedirectInProgress = true;
          const returnUrl = safeInternalReturnUrl(router.url);
          queueMicrotask(() => {
            void router
              .navigate(['/login'], { queryParams: { returnUrl } })
              .finally(() => (sessionRedirectInProgress = false));
          });
        }
      }
      return throwError(() => error);
    }),
  );
};

function readCookie(cookieHeader: string, name: string): string | null {
  const prefix = `${name}=`;
  const cookie = cookieHeader.split(';').map((value) => value.trim()).find((value) => value.startsWith(prefix));
  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : null;
}
