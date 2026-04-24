const baseUrl = (process.env.BUYERBOARD_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || 'GET',
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  let json = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Expected JSON from ${path}, but received: ${text.slice(0, 200)}`);
  }

  return { response, json };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function expectStatus(path, options, expectedStatus, assertion) {
  const { response, json } = await request(path, options);
  assert(
    response.status === expectedStatus,
    `${options?.method || 'GET'} ${path} returned ${response.status} instead of ${expectedStatus}. Body: ${JSON.stringify(json)}`,
  );

  if (assertion) {
    assertion(json);
  }
}

async function expectOneOfStatuses(path, options, expectedStatuses, assertion) {
  const { response, json } = await request(path, options);
  assert(
    expectedStatuses.includes(response.status),
    `${options?.method || 'GET'} ${path} returned ${response.status} instead of one of ${expectedStatuses.join(', ')}. Body: ${JSON.stringify(json)}`,
  );

  if (assertion) {
    assertion({
      status: response.status,
      json,
    });
  }
}

async function main() {
  await expectStatus('/api/requests', undefined, 200, (json) => {
    assert(Array.isArray(json.requests), 'GET /api/requests should return a requests array.');
  });

  await expectStatus('/api/home/highlights', undefined, 200, (json) => {
    assert(json && typeof json.highlights === 'object', 'GET /api/home/highlights should return a highlights object.');
  });

  const protectedWriteChecks = [
    {
      path: '/api/requests',
      options: {
        method: 'POST',
        body: {
          title: '',
          category: '',
          description: '',
          shippingPreference: '',
          targetBudget: '',
        },
      },
    },
    {
      path: '/api/messages/threads',
      options: {
        method: 'POST',
        body: {},
      },
    },
    {
      path: '/api/messages/threads/test-thread/messages',
      options: {
        method: 'POST',
        body: { body: '' },
      },
    },
    {
      path: '/api/reviews',
      options: {
        method: 'POST',
        body: { transactionId: 'tx', requestId: 'req' },
      },
    },
    {
      path: '/api/disputes',
      options: {
        method: 'POST',
        body: { transactionId: 'tx', requestId: 'req', reason: 'other', details: 'problem' },
      },
    },
    {
      path: '/api/reports',
      options: {
        method: 'POST',
        body: { requestId: 'req', reason: 'spam', details: 'Looks bad' },
      },
    },
    {
      path: '/api/notifications/preferences',
      options: {
        method: 'PUT',
        body: { watchlist: false },
      },
    },
    {
      path: '/api/notifications/test-notification',
      options: {
        method: 'PATCH',
        body: {},
      },
    },
    {
      path: '/api/notifications/test-notification',
      options: {
        method: 'DELETE',
      },
    },
    {
      path: '/api/notifications',
      options: {
        method: 'PATCH',
        body: { notificationIds: ['note-1'] },
      },
    },
    {
      path: '/api/notifications',
      options: {
        method: 'DELETE',
        body: { notificationIds: ['note-1'] },
      },
    },
    {
      path: '/api/claims/test-claim/complete',
      options: {
        method: 'POST',
        body: { requestId: 'req' },
      },
    },
    {
      path: '/api/relationships/test-member',
      options: {
        method: 'POST',
        body: { action: 'follow' },
      },
    },
    {
      path: '/api/admin/reports/test-report/resolution',
      options: {
        method: 'POST',
        body: { requestId: 'req', resolution: 'dismissed', adminNote: 'checked' },
      },
    },
    {
      path: '/api/admin/disputes/test-dispute/resolution',
      options: {
        method: 'POST',
        body: { resolution: 'closed', resolutionNote: 'checked' },
      },
    },
  ];

  for (const check of protectedWriteChecks) {
    await expectStatus(check.path, check.options, 401, (json) => {
      assert(json?.error === 'Sign in required.', `${check.options.method} ${check.path} should fail with Sign in required.`);
    });
  }

  await expectStatus('/api/relationships/test-member', undefined, 401, (json) => {
    assert(json?.error === 'Sign in required.', 'GET /api/relationships/[memberId] should require auth.');
  });

  await expectStatus('/api/messages/threads', undefined, 401, (json) => {
    assert(json?.error === 'Sign in required.', 'GET /api/messages/threads should require auth.');
  });

  await expectStatus('/api/messages/threads/test-thread', undefined, 401, (json) => {
    assert(json?.error === 'Sign in required.', 'GET /api/messages/threads/[threadId] should require auth.');
  });

  await expectStatus('/api/notifications', undefined, 401, (json) => {
    assert(json?.error === 'Sign in required.', 'GET /api/notifications should require auth.');
  });

  const internalJobChecks = [
    '/api/internal/digests/run',
    '/api/internal/requests/stale/run',
  ];

  for (const path of internalJobChecks) {
    await expectOneOfStatuses(path, { method: 'POST' }, [401, 500], ({ status, json }) => {
      if (status === 401) {
        assert(json?.error === 'Unauthorized.', `${path} should reject unauthenticated internal job calls.`);
        return;
      }

      assert(
        json?.error === 'Internal cron secret is not configured. Add BUYERBOARD_INTERNAL_CRON_SECRET to .env.local.',
        `${path} should explain the missing cron secret when local internal job auth is not configured.`,
      );
    });
  }

  console.log('BuyerBoard launch QA smoke checks passed.');
}

main().catch((error) => {
  console.error('BuyerBoard launch QA smoke checks failed.');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
