import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Administrar adhesión",
  robots: { index: false, follow: false },
};

export default function AdhesionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
