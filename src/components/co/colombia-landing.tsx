import { BlockchainIntegrity } from "@/components/co/blockchain-integrity";
import { CollectionControls } from "@/components/co/collection-controls";
import { CollectionUseCases } from "@/components/co/collection-use-cases";
import { ColombiaCompliance } from "@/components/co/colombia-compliance";
import { ColombiaFooter } from "@/components/co/colombia-footer";
import { ColombiaHeader } from "@/components/co/colombia-header";
import { ColombiaHero } from "@/components/co/colombia-hero";
import { DemoForm } from "@/components/co/demo-form";
import { EvidenceSection } from "@/components/co/evidence-section";
import { HowItWorks } from "@/components/co/how-it-works";
import { Industries } from "@/components/co/industries";
import { Integrations } from "@/components/co/integrations";
import { PainPoints } from "@/components/co/pain-points";
import { VolumeCTA } from "@/components/co/volume-cta";
import { JsonLd } from "@/components/json-ld";
import {
  colombiaOrganizationJsonLd,
  colombiaSoftwareJsonLd,
  colombiaWebPageJsonLd,
} from "@/lib/colombia-site";

export function ColombiaLanding() {
  return (
    <div className="brand-canvas flex min-h-screen flex-col text-foreground">
      {/*
        THESIS: Notificas Colombia is collection-ops infrastructure, not a translated Argentine legal landing and not a consumer site.
        OWN-WORLD: Incumbent navy/teal Notificas system, Sora display, Inter UI, campaign console as the proof object.
        STORY: A collections/risk/ops manager sees volume + evidence, then books a demo.
        FIRST VIEWPORT: Dark navy hero; left H1 "Cobranza digital. Con evidencia." + dual CTAs; right live campaign board.
        FORM: Established Notificas world; specified Colombian B2B surface; code-led.
        FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
      */}
      <JsonLd data={colombiaOrganizationJsonLd()} />
      <JsonLd data={colombiaSoftwareJsonLd()} />
      <JsonLd data={colombiaWebPageJsonLd()} />
      <ColombiaHeader />
      <main className="flex-1">
        <ColombiaHero />
        <PainPoints />
        <HowItWorks />
        <CollectionUseCases />
        <ColombiaCompliance />
        <CollectionControls />
        <EvidenceSection />
        <BlockchainIntegrity />
        <Integrations />
        <Industries />
        <VolumeCTA />
        <DemoForm />
      </main>
      <ColombiaFooter />
    </div>
  );
}
