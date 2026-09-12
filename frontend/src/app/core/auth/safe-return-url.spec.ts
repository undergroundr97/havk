import { isPrivateApplicationUrl, safeInternalReturnUrl } from './safe-return-url';

describe('safe return URLs', () => {
  it('preserves internal paths, queries and fragments', () => {
    expect(safeInternalReturnUrl('/relatorios?pagina=2#resultado')).toBe(
      '/relatorios?pagina=2#resultado',
    );
  });

  it.each([
    'https://evil.example/report',
    '//evil.example/report',
    '/\\evil.example/report',
    'javascript:alert(1)',
    ' relatorios',
  ])('rejects an unsafe return URL: %s', (value) => {
    expect(safeInternalReturnUrl(value)).toBe('/dashboard');
  });

  it('recognizes every authenticated route root without treating public routes as private', () => {
    expect(isPrivateApplicationUrl('/dashboard')).toBe(true);
    expect(isPrivateApplicationUrl('/conta')).toBe(true);
    expect(isPrivateApplicationUrl('/perfil/onboarding')).toBe(true);
    expect(isPrivateApplicationUrl('/canal/editar')).toBe(true);
    expect(isPrivateApplicationUrl('/relatorios/00000000-0000-4000-8000-000000000001')).toBe(true);
    expect(isPrivateApplicationUrl('/login')).toBe(false);
    expect(isPrivateApplicationUrl('//evil.example/relatorios')).toBe(false);
  });
});
