import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import createStaffHandler from './create-staff.js';

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));

function makeRequest(body: unknown, method = 'POST'): IncomingMessage {
  const request = Readable.from(body === undefined ? [] : [JSON.stringify(body)]);
  return Object.assign(request, {
    method,
    headers: { authorization: 'Bearer access-token' },
  }) as unknown as IncomingMessage;
}

function makeResponse() {
  return {
    statusCode: 200,
    body: '',
    setHeader: vi.fn(),
    end(this: { body: string }, value?: string) {
      this.body = value ?? '';
    },
  };
}

describe('createStaffHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: 'actor-id', role: 'super_admin', is_active: true },
        error: null,
      }),
      insert: vi.fn().mockResolvedValue({ error: null }),
      delete: vi.fn().mockReturnThis(),
    };
    vi.mocked(createClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'actor-id' } }, error: null }),
        admin: {
          createUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: 'new-staff-id' } }, error: null }),
          deleteUser: vi.fn().mockResolvedValue({ error: null }),
        },
      },
      from: vi.fn(() => query),
    } as unknown as ReturnType<typeof createClient>);
  });

  it('creates a staff account and writes profile and audit', async () => {
    const response = makeResponse();

    await createStaffHandler(
      makeRequest({
        email: 'cashier@example.com',
        full_name: 'Kasir Uji',
        role: 'admin',
        password: 'secure-password-123',
      }),
      response as unknown as ServerResponse,
    );

    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.body)).toEqual({
      id: 'new-staff-id',
      email: 'cashier@example.com',
      full_name: 'Kasir Uji',
    });
  });

  it('rejects invalid input before creating a Supabase client', async () => {
    const response = makeResponse();

    await createStaffHandler(
      makeRequest({ email: 'invalid' }),
      response as unknown as ServerResponse,
    );

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({ error: 'INPUT_INVALID' });
    expect(createClient).not.toHaveBeenCalled();
  });
});
