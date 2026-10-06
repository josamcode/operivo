import { db } from '../db';

export const getFounder = () => db.founder.findUnique({ where: { id: 'founder' } });

export async function requireFounder() {
  const f = await getFounder();
  if (!f) throw new Error('Setup not complete');
  return f;
}
