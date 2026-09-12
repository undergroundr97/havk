import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { PublicLayout } from './public-layout';

@Component({ standalone: true, template: '<p>Página pública</p>' })
class PublicPageStub {}

describe('PublicLayout', () => {
  it('renders the public shell without private navigation', async () => {
    TestBed.configureTestingModule({
      imports: [PublicLayout],
      providers: [provideRouter([{ path: '', component: PublicPageStub }])],
    });
    const fixture = TestBed.createComponent(PublicLayout);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.public-layout')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.sidebar')).toBeNull();
    expect(fixture.nativeElement.querySelector('[aria-label="Navegação autenticada"]')).toBeNull();
  });
});
