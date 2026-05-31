const baseUrl = process.env.APP_BASE_URL || 'http://127.0.0.1:3030';

async function request(path, options) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${options?.method || 'GET'} ${path} failed: ${JSON.stringify(body)}`);
  }
  return body;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const createdCase = await request('/api/cases', { method: 'POST' });

try {
  const state = await request(`/api/app-state/reset?caseId=${encodeURIComponent(createdCase.id)}`, {
    method: 'POST',
  });

  assert(state.familyMembers.length === 2, `Expected 2 sample family members, got ${state.familyMembers.length}`);
  assert(state.policies.length === 4, `Expected 4 sample policies, got ${state.policies.length}`);

  const memberIds = new Set(state.familyMembers.map(member => member.id));
  const policyIds = new Set(state.policies.map(policy => policy.id));

  assert(memberIds.size === state.familyMembers.length, 'Sample family member IDs must be unique');
  assert(policyIds.size === state.policies.length, 'Sample policy IDs must be unique');
  assert(
    state.policies.every(policy => memberIds.has(policy.insuredId)),
    'Every sample policy must reference an inserted insured member',
  );
  assert(
    state.policies.every(policy => !policy.beneficiaryId || memberIds.has(policy.beneficiaryId)),
    'Every sample policy beneficiary must reference an inserted family member',
  );

  console.log(JSON.stringify({
    ok: true,
    caseId: createdCase.id,
    familyMembers: state.familyMembers.length,
    policies: state.policies.length,
  }));
} finally {
  await request(`/api/cases/${encodeURIComponent(createdCase.id)}`, { method: 'DELETE' }).catch(() => {});
}
