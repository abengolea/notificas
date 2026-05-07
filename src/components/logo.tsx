import Image from "next/image";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Image
      src="/notificasLogo.jpg"
      alt="Notificas"
      width={152}
      height={152}
      className={cn("object-contain", className)}
      priority
    />
  );
}
