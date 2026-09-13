import type { ArtIdentityProviderId } from "@/lib/art/types";
import type { IdentityProvider } from "@/lib/art/identity/types";
import { ManualOrPrevalidatedIdentityProvider } from "@/lib/art/identity/prevalidated";
import { DiditIdentityProvider, RenaperIdentityProvider } from "@/lib/art/identity/stubs";

const PREVALIDATED = new ManualOrPrevalidatedIdentityProvider();
const RENAPER = new RenaperIdentityProvider();
const DIDIT = new DiditIdentityProvider();

export function getIdentityProvider(id: ArtIdentityProviderId | null | undefined): IdentityProvider {
  switch (id) {
    case "RENAPER":
      return RENAPER;
    case "DIDIT":
      return DIDIT;
    case "ART_PREVALIDATED":
    case "MANUAL":
    default:
      return PREVALIDATED;
  }
}

export { ManualOrPrevalidatedIdentityProvider } from "@/lib/art/identity/prevalidated";
export {
  IdentityProviderNotConfiguredError,
  type IdentityProvider,
} from "@/lib/art/identity/types";
