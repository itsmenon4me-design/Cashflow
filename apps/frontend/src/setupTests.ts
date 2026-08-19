import "@testing-library/jest-dom";

// Prevent jsdom navigation warnings by stubbing window.location.assign in test env
if (typeof window !== "undefined") {
  try {
    // Some test environments provide location but not assign implementation
    if (!window.location || typeof window.location.assign !== 'function') {
      // @ts-ignore - augment in test runtime only
      window.location = { ...window.location, assign: () => {} } as Location;
    } else {
      // override to no-op to avoid jsdom navigation error
      const originalAssign = window.location.assign.bind(window.location);
      // @ts-ignore
      window.location.assign = (..._args: any[]) => {
        // no-op during tests
      };
      // keep original if needed in specific tests
      (window as any).__originalLocationAssign = originalAssign;
    }
  } catch (e) {
    // swallow — test env may not allow modification
  }
}

