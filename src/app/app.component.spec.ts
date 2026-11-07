import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';
import { TOOLS } from './core/data/tools.data';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create the app shell', () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the sidebar with every tool', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const labels = Array.from(el.querySelectorAll('app-sidebar a.link')).map((a) => a.textContent?.trim());
    expect(labels).toEqual(['Overview', ...TOOLS.map((t) => t.title)]);
  });

  it('should toggle the mobile navigation drawer', () => {
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
