import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { I18nProvider } from '../../../i18n/I18nProvider';
import OnboardingTour from '../OnboardingTour';

/**
 * The tour's positioning effect attaches a `resize` listener each time it runs,
 * so counting those attachments counts effect runs. A runaway effect would spin
 * forever and starve the test's timeout, so the guard throws once the count is
 * clearly past anything a healthy mount needs — that turns a hang into a
 * readable failure.
 */
const EFFECT_RUN_LIMIT = 25;

function trackPositioningEffect() {
  const original = window.addEventListener.bind(window);
  const counter = { runs: 0 };
  vi.spyOn(window, 'addEventListener').mockImplementation((type, ...rest) => {
    if (type === 'resize') {
      counter.runs += 1;
      if (counter.runs > EFFECT_RUN_LIMIT) {
        throw new Error(`positioning effect ran ${counter.runs} times — infinite update loop`);
      }
    }
    return original(type, ...rest);
  });
  return counter;
}

function Tour(props) {
  return (
    <I18nProvider>
      <OnboardingTour active onComplete={() => {}} hasProject={false} {...props} />
    </I18nProvider>
  );
}

describe('OnboardingTour', () => {
  let errorSpy;

  beforeEach(() => {
    // Skip I18nProvider's backend language fetch.
    localStorage.setItem('ui-lang', 'en');
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('settles without an infinite update loop when active', () => {
    const counter = trackPositioningEffect();

    render(<Tour />);

    expect(counter.runs).toBeLessThanOrEqual(EFFECT_RUN_LIMIT);
    const loopErrors = errorSpy.mock.calls.filter((args) => String(args[0]).includes('Maximum update depth'));
    expect(loopErrors).toEqual([]);
  });

  it('does not re-run positioning when re-rendered with unchanged props', () => {
    const counter = trackPositioningEffect();
    const { rerender } = render(<Tour />);
    const afterMount = counter.runs;

    rerender(<Tour />);

    expect(counter.runs).toBe(afterMount);
  });

  it('renders nothing when inactive', () => {
    const { container } = render(<Tour active={false} />);
    expect(container).toBeEmptyDOMElement();
  });
});
