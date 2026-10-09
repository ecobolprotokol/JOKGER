import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { IncomingMessage, ServerResponse } from 'node:http';

const requestSchema = z.object({
  email: z.string().trim().email().max(254),
  full_name: z.string().trim().min(1).max(100),
  role: z.enum(['admin', 'super_admin']),
  password: z.string().min(10).max(128),
});

const MAX_BODY_BYTES = 8_192;

async function readBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) {
      throw new RangeError('BODY_TOO_LARGE');
    }
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}

export default async function createStaffHandler(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    response.statusCode = 405;
    response.end(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }));
    return;
  }

  const authorization = request.headers.authorization;
  const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!accessToken || !supabaseUrl || !serviceRoleKey) {
    response.statusCode = !supabaseUrl || !serviceRoleKey ? 500 : 401;
    response.end(
      JSON.stringify({
        error: !supabaseUrl || !serviceRoleKey ? 'SERVER_NOT_CONFIGURED' : 'NOT_AUTHORIZED',
      }),
    );
    return;
  }

  let body: unknown;
  try {
    body = await readBody(request);
  } catch (error: unknown) {
    response.statusCode = error instanceof RangeError ? 413 : 400;
    response.end(
      JSON.stringify({ error: error instanceof RangeError ? 'INPUT_INVALID' : 'INPUT_INVALID' }),
    );
    return;
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    response.statusCode = 400;
    response.end(JSON.stringify({ error: 'INPUT_INVALID' }));
    return;
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData, error: authError } = await admin.auth.getUser(accessToken);
  if (authError || !authData.user) {
    response.statusCode = 401;
    response.end(JSON.stringify({ error: 'NOT_AUTHORIZED' }));
    return;
  }

  const { data: actor, error: actorError } = await admin
    .from('profiles')
    .select('id, role, is_active')
    .eq('id', authData.user.id)
    .maybeSingle();
  if (actorError || !actor?.is_active || actor.role !== 'super_admin') {
    response.statusCode = 403;
    response.end(JSON.stringify({ error: 'NOT_AUTHORIZED' }));
    return;
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.full_name },
  });
  if (createError || !created.user) {
    response.statusCode = 400;
    response.end(
      JSON.stringify({
        error: createError?.message.includes('already') ? 'STAFF_EMAIL_EXISTS' : 'INPUT_INVALID',
      }),
    );
    return;
  }

  const { error: profileError } = await admin.from('profiles').insert({
    id: created.user.id,
    email: parsed.data.email,
    full_name: parsed.data.full_name,
    role: parsed.data.role,
    is_active: true,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    response.statusCode = 500;
    response.end(JSON.stringify({ error: 'UNKNOWN' }));
    return;
  }

  const { error: auditError } = await admin.from('audit_logs').insert({
    actor_id: authData.user.id,
    action: 'staff.create',
    entity: 'profile',
    entity_id: created.user.id,
    payload: { email: parsed.data.email, role: parsed.data.role },
  });
  if (auditError) {
    await admin.from('profiles').delete().eq('id', created.user.id);
    await admin.auth.admin.deleteUser(created.user.id);
    response.statusCode = 500;
    response.end(JSON.stringify({ error: 'UNKNOWN' }));
    return;
  }

  response.statusCode = 201;
  response.end(
    JSON.stringify({
      id: created.user.id,
      email: parsed.data.email,
      full_name: parsed.data.full_name,
    }),
  );
}
