import { Route, Routes } from '@angular/router';
import { routes } from '../app.routes';

export const demoRoutes: Routes = [
  { path: '', pathMatch: 'full', title: 'Hub demo — HAVK',
    loadComponent: () => import('./hub-page').then(({ DemoHubPage }) => DemoHubPage) },
  ...routes.map(publicRoute),
];

function publicRoute(route: Route): Route {
  const children = route.children?.map((child, index) => {
    const copy = publicRoute(child);
    return route.path === '' && index === 0 && child.path === '' ? { ...copy, path: 'apresentacao' } : copy;
  });
  return { ...route, canActivate: undefined, canActivateChild: undefined, canMatch: undefined, children };
}
