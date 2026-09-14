import { LandingHeader } from "@/components/landing-header";
import {
  BRAZIL_NAV_LINKS,
  BRAZIL_PATH,
  BRAZIL_THEME_LABELS,
} from "@/lib/brazil-site";

export function BrazilHeader() {
  return (
    <LandingHeader
      homeHref={BRAZIL_PATH}
      navLinks={[...BRAZIL_NAV_LINKS]}
      showAuthActions={false}
      primaryAction={{ href: `${BRAZIL_PATH}#cotacao`, label: "Solicitar cotação" }}
      menuLabel="Menu"
      openMenuLabel="Abrir menu"
      themeLabel="Tema: claro, escuro ou sistema"
      themeLabels={{ ...BRAZIL_THEME_LABELS }}
      localeBadge="Brasil"
    />
  );
}
