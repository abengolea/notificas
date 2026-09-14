import { LandingHeader } from "@/components/landing-header";
import { colombiaCopy } from "@/lib/colombia-content";
import { COLOMBIA_NAV_LINKS, COLOMBIA_PATH } from "@/lib/colombia-site";

export function ColombiaHeader() {
  return (
    <LandingHeader
      homeHref={COLOMBIA_PATH}
      navLinks={[...COLOMBIA_NAV_LINKS]}
      showAuthActions={false}
      primaryAction={{
        href: `${COLOMBIA_PATH}#demostracion`,
        label: colombiaCopy.nav.demo,
      }}
      menuLabel={colombiaCopy.nav.menu}
      openMenuLabel={colombiaCopy.nav.abrirMenu}
      themeLabel={colombiaCopy.nav.tema}
      themeLabels={{
        light: colombiaCopy.nav.temaClaro,
        dark: colombiaCopy.nav.temaOscuro,
        system: colombiaCopy.nav.temaSistema,
      }}
      localeBadge={colombiaCopy.brand.localeBadge}
      navBreakpoint="xl"
    />
  );
}
