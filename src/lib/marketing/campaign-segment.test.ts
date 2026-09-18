import { test } from "node:test";
import assert from "node:assert/strict";
import { marketingContext } from "./context";
import {
  loadCampaignCatalog,
  previewCrmCampaignAudience,
} from "./campaign-segment";
import { createMemoryMarketingRepositories } from "./repositories/memory";
import { createMarketingServices } from "./services";
import { TAXONOMY_INDUSTRIES, TAXONOMY_USE_CASES } from "./taxonomy/seed";

function setup(workspaceId = "notificas-internal") {
  const repos = createMemoryMarketingRepositories();
  const services = createMarketingServices(repos);
  const ctx = marketingContext(workspaceId, { actorType: "system", actorId: "campaign-ui" });
  return { repos, services, ctx, workspaceId, deps: { services, workspaceId } };
}

test("el catálogo de campaña es el catálogo fijo de rubros y casos de uso", async () => {
  const { deps } = setup();
  const catalog = await loadCampaignCatalog(deps);
  assert.ok(catalog.countries.some((row) => row.code === "AR"));
  assert.ok(catalog.industries.some((row) => row.key === "gas"));
  assert.ok(catalog.industries.some((row) => row.key === "seguros"));
  assert.ok(catalog.industries.some((row) => row.key === "carteras_credito"));
  assert.ok(!catalog.industries.some((row) => row.key === "utilities_gas"));
  assert.ok(!catalog.industries.some((row) => row.key === "cesion_credito"));
  assert.ok(catalog.useCases.some((row) => row.key === "aviso_corte"));
  assert.ok(catalog.useCases.some((row) => row.key === "cesion_credito"));
  assert.equal(catalog.industries.length, TAXONOMY_INDUSTRIES.filter((row) => row.active).length);
  assert.equal(catalog.useCases.length, TAXONOMY_USE_CASES.filter((row) => row.active).length);
});

test("la audiencia CRM filtra país + rubro + caso de uso", async () => {
  const { services, ctx, deps } = setup();
  const camuzzi = await services.companies.createCompany(ctx, {
    name: "Camuzzi Gas",
    countryCode: "AR",
  });
  await services.companies.createCompany(ctx, {
    name: "Empresa Sur",
    countryCode: "CL",
  });
  await services.contacts.createContact(ctx, {
    email: "ops@camuzzi.test",
    name: "Operaciones",
    company: "Camuzzi Gas",
    companyId: camuzzi.company.id,
    countryCode: "AR",
  });
  const arGas = await previewCrmCampaignAudience(
    { countryCode: "AR", industryId: "gas", useCaseId: "aviso_corte" },
    ["new", "sent", "opened", "clicked", "replied"],
    deps,
  );
  assert.equal(arGas.companyCount, 1);
  assert.equal(arGas.eligible, 1);
  assert.equal(arGas.contacts[0]?.email, "ops@camuzzi.test");

  const clGas = await previewCrmCampaignAudience(
    { countryCode: "CL", industryId: "gas", useCaseId: "aviso_corte" },
    ["new"],
    deps,
  );
  assert.equal(clGas.companyCount, 0);
  assert.equal(clGas.total, 0);

  const insurance = await previewCrmCampaignAudience(
    { countryCode: "AR", industryId: "seguros", useCaseId: "rechazo_siniestro" },
    ["new"],
    deps,
  );
  assert.equal(insurance.companyCount, 0);
});

test("la audiencia CRM usa industryIds persistidos y alias del catálogo anterior", async () => {
  const { services, ctx, deps } = setup();
  await services.industries.createIndustry(ctx, { key: "legal", name: "Servicios jurídicos" });
  const firm = await services.companies.createCompany(ctx, {
    name: "Estudio Norte",
    countryCode: "UY",
    industryIds: ["legal"],
    useCaseIds: ["entrega_documentacion"],
  });
  await services.contacts.createContact(ctx, {
    email: "socio@norte.test",
    name: "Socio",
    company: "Estudio Norte",
    companyId: firm.company.id,
    countryCode: "UY",
  });
  const audience = await previewCrmCampaignAudience(
    { countryCode: "UY", industryId: "estudios_juridicos", useCaseId: "entrega_documentacion" },
    ["new"],
    deps,
  );
  assert.equal(audience.companyCount, 1);
  assert.equal(audience.eligible, 1);
});

test("la audiencia CRM acepta varios casos de uso", async () => {
  const { services, ctx, deps } = setup();
  const broker = await services.companies.createCompany(ctx, {
    name: "InvertirOnline S.A.U.",
    countryCode: "AR",
  });
  await services.contacts.createContact(ctx, {
    email: "consultas@invertironline.test",
    name: "Consultas",
    company: "InvertirOnline S.A.U.",
    companyId: broker.company.id,
    countryCode: "AR",
  });
  const some = await previewCrmCampaignAudience(
    { countryCode: "AR", industryId: "mercado_capitales", useCaseIds: ["aviso_comitentes", "cambio_contractual"] },
    ["new"],
    deps,
  );
  assert.equal(some.companyCount, 1);
  assert.equal(some.eligible, 1);
});
