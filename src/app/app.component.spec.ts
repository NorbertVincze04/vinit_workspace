import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';
import { AuthService } from './core/auth/auth.service';
import { TOOLS } from './core/data/tools.data';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  const signIn = (): void =>
    TestBed.inject(AuthService).user.set({ id: 'u1', email: 'ana@vinit.test', fullName: 'Ana', role: 'owner' });

  it('should create the app shell', () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('shows no workspace navigation before sign-in', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('app-sidebar')).toBeNull();
  });

  it('should render the sidebar with every tool once signed in', () => {
    signIn();
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const labels = Array.from(el.querySelectorAll('app-sidebar a.link')).map((a) => a.textContent?.trim());
    expect(labels).toEqual(['Overview', ...TOOLS.map((t) => t.title)]);
    expect(el.querySelector('app-sidebar')?.textContent).toContain('Sign out');
  });

  it('should toggle the mobile navigation drawer', () => {
    signIn();
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const toggle = el.querySelector<HTMLButtonElement>('.topbar button')!;
    toggle.click();
    fixture.detectChanges();
    expect(el.querySelector('app-sidebar')?.classList).toContain('is-open');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });
});
