import type { SVGProps } from "react";

export function AppleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        fill="currentColor"
        d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.51-3.23 0-1.44.65-2.2.46-3.07-.4C3.79 16.17 4.36 9.2 8.96 8.97c1.25.06 2.12.65 2.87.66.98-.2 1.92-.76 3-.77 1.31.02 2.26.53 2.96 1.34-2.68 1.6-2.04 5.14.54 6.35-.62 1.62-1.42 3.21-2.28 4.73ZM12.03 8.86c-.15-2.23 1.66-4.07 3.74-4.25.3 2.44-2.2 4.36-3.74 4.25Z"
      />
    </svg>
  );
}
