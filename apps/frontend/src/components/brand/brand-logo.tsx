import Image from "next/image";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  variant?: "mark" | "lockup";
  alt?: string;
  className?: string;
}

export function BrandLogo({
  variant = "mark",
  alt = "neraca",
  className,
}: BrandLogoProps) {
  if (variant === "mark") {
    return (
      <Image
        src="/brand/neraca-mark.svg"
        alt={alt}
        width={120}
        height={120}
        className={className}
      />
    );
  }

  return (
    <>
      <Image
        src="/brand/neraca-lockup.svg"
        alt=""
        aria-hidden="true"
        width={340}
        height={120}
        className={cn(className, "hidden dark:block")}
      />
      <Image
        src="/brand/neraca-lockup-light.svg"
        alt={alt}
        width={340}
        height={120}
        className={cn(className, "dark:hidden")}
      />
    </>
  );
}
