import assert from "node:assert/strict";
import test from "node:test";
import {
  addCustomerFacilityReturnPath,
  createNextActionReturnPath,
  createOpportunityReturnPath,
  loginPath,
  logActivityReturnPath,
  mutationReturnOpportunityId,
  safeSingleInternalPath,
  saveContactReturnPath,
  updateCustomerReturnPath,
  validatedInternalPath,
  withInheritedHash,
  withReturnTo,
// Node's type-stripping test runner requires a TypeScript extension.
// @ts-expect-error direct test import
} from "../../../src/shared/lib/internal-navigation.ts";
import {
  providerWorkspaceTabHref,
// Node's type-stripping test runner requires a TypeScript extension.
// @ts-expect-error direct test import
} from "../../../src/features/accounts/lib/provider-workspace-tabs.ts";

const providerId = "00000000-0000-4000-8000-000000000001";
const otherProviderId = "00000000-0000-4000-8000-000000000002";
const opportunityId = "00000000-0000-4000-8000-000000000011";
const otherOpportunityId = "00000000-0000-4000-8000-000000000012";

function form(...returnTargets: string[]) {
  const formData = new FormData();
  for (const target of returnTargets) formData.append("return_to", target);
  return formData;
}

const providerOnlyPolicies = {
  saveContact: saveContactReturnPath,
  createOpportunity: createOpportunityReturnPath,
  updateCustomer: updateCustomerReturnPath,
  addCustomerFacility: addCustomerFacilityReturnPath,
};

for (const [action, policy] of Object.entries(providerOnlyPolicies)) {
  test(`${action} returns only to the submitted Provider workspace`, () => {
    const expected = `/providers/${providerId}?tab=commercial&facility=facility-1#customer`;
    assert.equal(policy(form(expected), providerId), expected);

    for (const invalid of [
      `/providers/${otherProviderId}?tab=commercial#customer`,
      `/opportunities/${opportunityId}`,
      "/tasks?filter=open",
      "/pipeline",
      "/customers",
      "/dashboard",
      "/login",
      `/customers/../providers/${providerId}?tab=commercial`,
      `/customers/%2e%2e/providers/${providerId}?tab=commercial`,
      `/customers/.%2E/providers/${providerId}?tab=commercial`,
      `/%3f/%2e%2e/providers/${providerId}?tab=commercial#customer`,
      `/providers/${providerId}?tab=commercial&returnTo=${encodeURIComponent("/a/%3f/%2e%2e/b")}`,
    ]) {
      assert.equal(policy(form(invalid), providerId), null, invalid);
    }
  });

  test(`${action} rejects missing and duplicate return fields`, () => {
    const safe = `/providers/${providerId}?tab=people#contacts`;
    const unsafe = "/dashboard";
    assert.equal(policy(form(), providerId), null);
    assert.equal(policy(form(safe, safe), providerId), null);
    assert.equal(policy(form(safe, unsafe), providerId), null);
    assert.equal(policy(form(unsafe, safe), providerId), null);
  });
}

const providerOrOpportunityPolicies = {
  logActivity: logActivityReturnPath,
  createNextAction: createNextActionReturnPath,
};

test("Tasks to Provider to Opportunity preserves each structured return layer", () => {
  const tasksPath = "/tasks?filter=open";
  const providerPath = providerWorkspaceTabHref(
    providerId,
    "commercial",
    null,
    undefined,
    tasksPath,
  );
  const expectedProviderPath = `/providers/${providerId}?tab=commercial&returnTo=%2Ftasks%3Ffilter%3Dopen`;
  assert.equal(providerPath, expectedProviderPath);

  const providerOrigin = withInheritedHash(providerPath, "#opportunities");
  assert.equal(providerOrigin, `${expectedProviderPath}#opportunities`);

  const opportunityPath = withReturnTo(
    `/opportunities/${opportunityId}`,
    providerOrigin,
  );
  const expectedOpportunityPath = `/opportunities/${opportunityId}?returnTo=%2Fproviders%2F${providerId}%3Ftab%3Dcommercial%26returnTo%3D%252Ftasks%253Ffilter%253Dopen%23opportunities`;
  assert.equal(opportunityPath, expectedOpportunityPath);
  assert.equal(validatedInternalPath(opportunityPath), opportunityPath);
  assert.equal(safeSingleInternalPath([opportunityPath]), opportunityPath);

  const expectedLoginPath = `/login?returnTo=%2Fopportunities%2F${opportunityId}%3FreturnTo%3D%252Fproviders%252F${providerId}%253Ftab%253Dcommercial%2526returnTo%253D%25252Ftasks%25253Ffilter%25253Dopen%2523opportunities`;
  const builtLoginPath = loginPath(opportunityPath);
  assert.equal(builtLoginPath, expectedLoginPath);
  assert.equal(validatedInternalPath(builtLoginPath), builtLoginPath);
  assert.equal(
    new URL(builtLoginPath, "https://karrot.invalid").searchParams.get("returnTo"),
    opportunityPath,
  );

  const returnForm = form(opportunityPath);
  const verifiedOpportunityId = mutationReturnOpportunityId(returnForm);
  assert.equal(verifiedOpportunityId, opportunityId);
  assert.equal(
    logActivityReturnPath(returnForm, providerId, verifiedOpportunityId),
    opportunityPath,
  );
  assert.equal(
    createNextActionReturnPath(returnForm, providerId, verifiedOpportunityId),
    opportunityPath,
  );
});

for (const [action, policy] of Object.entries(providerOrOpportunityPolicies)) {
  test(`${action} accepts only the Provider or a database-verified Opportunity`, () => {
    const providerPath = `/providers/${providerId}?tab=commercial#activity`;
    const opportunityPath = `/opportunities/${opportunityId}?returnTo=%2Fpipeline#activity`;
    assert.equal(policy(form(providerPath), providerId, null), providerPath);
    assert.equal(
      policy(form(opportunityPath), providerId, opportunityId),
      opportunityPath,
    );
    assert.equal(policy(form(opportunityPath), providerId, null), null);
    assert.equal(
      policy(
        form(`/opportunities/${otherOpportunityId}`),
        providerId,
        opportunityId,
      ),
      null,
    );
    assert.equal(
      policy(form(`/providers/${otherProviderId}`), providerId, opportunityId),
      null,
    );
    assert.equal(
      policy(
        form(`/customers/../providers/${providerId}?tab=commercial`),
        providerId,
        opportunityId,
      ),
      null,
    );
  });

  test(`${action} rejects duplicate return fields before resource scoping`, () => {
    const providerPath = `/providers/${providerId}?tab=commercial`;
    const opportunityPath = `/opportunities/${opportunityId}`;
    assert.equal(
      policy(form(providerPath, opportunityPath), providerId, opportunityId),
      null,
    );
    assert.equal(
      policy(form(opportunityPath, providerPath), providerId, opportunityId),
      null,
    );
    assert.equal(
      policy(form(opportunityPath, opportunityPath), providerId, opportunityId),
      null,
    );
  });
}

test("Opportunity origins are parsed only from one exact, validated return field", () => {
  assert.equal(
    mutationReturnOpportunityId(
      form(`/opportunities/${opportunityId}?returnTo=%2Fpipeline#activity`),
    ),
    opportunityId,
  );
  assert.equal(mutationReturnOpportunityId(form(`/opportunities/${opportunityId}/edit`)), null);
  assert.equal(mutationReturnOpportunityId(form(`/providers/${providerId}`)), null);
  assert.equal(
    mutationReturnOpportunityId(
      form(`/opportunities/${opportunityId}`, `/opportunities/${otherOpportunityId}`),
    ),
    null,
  );
});
