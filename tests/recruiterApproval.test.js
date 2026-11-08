import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecruiterApprovalStatusResolver } from '../server/recruiterApproval.js';

test('approval resolver rejects invalid database pools', () => {
  assert.throws(() => createRecruiterApprovalStatusResolver(null), TypeError);
  assert.throws(() => createRecruiterApprovalStatusResolver({}), TypeError);
});

test('approval resolver rejects invalid recruiter IDs without querying the database', async () => {
  let calls = 0;
  const resolver = createRecruiterApprovalStatusResolver({
    async execute() {
      calls += 1;
      return [[], []];
    },
  });

  for (const id of [null, 17, '', '0', '-1', 'abc', '1.5', '9007199254740992']) {
    assert.equal(await resolver(id), null);
  }

  assert.equal(calls, 0);
});

test('approval resolver normalizes status and handles missing or non-string statuses', async () => {
  const resolver = createRecruiterApprovalStatusResolver({
    async execute(_sql, [id]) {
      if (id === 1) return [[{ status: 'approved' }], []];
      if (id === 2) return [[{ status: 42 }], []];
      return [[], []];
    },
  });

  assert.equal(await resolver('1'), 'APPROVED');
  assert.equal(await resolver('2'), null);
  assert.equal(await resolver('3'), null);
});

test('approval resolver propagates database failures', async () => {
  const resolver = createRecruiterApprovalStatusResolver({
    async execute() {
      throw new Error('Dummy database failure');
    },
  });

  await assert.rejects(resolver('1'), /Dummy database failure/);
});
