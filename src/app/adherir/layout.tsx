import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Adhesión a notificaciones electrónicas",
  robots: { index: false, follow: false },
};

export default function AdherirLayout({ children }: { children: React.ReactNode }) {
  return children;
}
