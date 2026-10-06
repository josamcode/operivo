import type { NotificationDTO } from '@opervio/contracts';
import { bus } from '../bus';
import { db } from '../db';
import { notificationDTO } from './dto';

/** Only for events the founder cares about: action due, decision, important completion, failure. */
export async function notify(kind: NotificationDTO['kind'], title: string, body?: string | null, link?: string | null) {
  const n = await db.notification.create({ data: { kind, title, body: body ?? null, link: link ?? null } });
  bus.emitEvent({ type: 'notification', notification: notificationDTO(n) });
  bus.invalidate('notifications', 'bootstrap');
  return n;
}
