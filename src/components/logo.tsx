import Image from "next/image";
import { cn } from "@/lib/utils";

const MARK = {
  src: "/notificasLogo.png",
  width: 826,
  height: 621,
  alt: "Notificas",
} as const;

const WORDMARK = {
  src: "/notificas-wordmark.png",
  width: 1024,
  height: 190,
  alt: "Notificas",
} as const;

const WORDMARK_ON_DARK = {
  src: "/notificas-wordmark-on-dark.png",
  width: 1024,
  height: 190,
} as const;

const LOCKUP = {
  src: "/notificas-lockup.png",
  width: 1024,
  height: 190,
  alt: "Notificas — Comunicaciones vía blockchain",
} as const;

type LogoProps = {
  className?: string;
  /** `mark` shield only. `wordmark` name. `lockup` name + slogan. */
  variant?: "mark" | "wordmark" | "lockup";
  /** White lockup for teal/dark surfaces. Skip theme swapping. */
  onDark?: boolean;
};

function BrandImage({
  src,
  alt,
  width,
  height,
  className,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={cn("object-contain", className)}
      quality={100}
      priority
    />
  );
}

export function Logo({ className, variant = "mark", onDark = false }: LogoProps) {
  if (variant === "wordmark" || variant === "lockup") {
    const light = variant === "lockup" ? LOCKUP : WORDMARK;
    const darkSrc = WORDMARK_ON_DARK.src;
    const alt = light.alt;

    if (onDark) {
      return (
        <BrandImage
          src={darkSrc}
          alt={alt}
          width={WORDMARK.width}
          height={WORDMARK.height}
          className={className}
        />
      );
    }

    return (
      <span className={cn("inline-flex items-center", className)}>
        <BrandImage
          src={light.src}
          alt={alt}
          width={light.width}
          height={light.height}
          className="h-full w-auto dark:hidden"
        />
        <BrandImage
          src={darkSrc}
          alt={alt}
          width={WORDMARK.width}
          height={WORDMARK.height}
          className="hidden h-full w-auto dark:block"
        />
      </span>
    );
  }

  return (
    <BrandImage
      src={MARK.src}
      alt={MARK.alt}
      width={MARK.width}
      height={MARK.height}
      className={className}
    />
  );
}
