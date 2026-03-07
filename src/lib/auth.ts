import { createClient } from '@/lib/supabase/server';
import { prisma } from './db';

export type SessionUser = { id: string; email: string } | null;

export async function getSession(): Promise<SessionUser> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const normalized = user.email.trim().toLowerCase();
  let dbUser = await prisma.user.findUnique({ where: { email: normalized } });
  if (!dbUser) {
    dbUser = await prisma.user.create({ data: { email: normalized } });
  }
  return { id: dbUser.id, email: dbUser.email };
}

// Legacy - no-op; Supabase handles session
export async function setSession(_userId: string) {}

export async function clearSession() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}

export async function getOrCreateUserByEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  let user = await prisma.user.findUnique({ where: { email: normalized } });
  if (!user) {
    user = await prisma.user.create({ data: { email: normalized } });
  }
  return user;
}
