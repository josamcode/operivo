import { z } from 'zod';
import { CollectionKey, FieldKey } from './common';

/**
 * Structured records the AI creates (leads, scripts, workouts, lessons…).
 * Every collection declares its fields; every record is validated against them.
 * Flexible enough for AI-created pages, typed enough to never become a junk drawer.
 */

export const FieldType = z.enum([
  'text',
  'longtext',
  'number',
  'currency',
  'percent',
  'date',
  'datetime',
  'url',
  'email',
  'phone',
  'status',
  'tags',
  'boolean',
  'person',
]);
export type FieldType = z.infer<typeof FieldType>;

export const FieldDef = z.strictObject({
  key: FieldKey,
  label: z.string().min(1).max(40),
  type: FieldType,
  options: z.array(z.string().min(1).max(40)).max(20).optional(),
});
export type FieldDef = z.infer<typeof FieldDef>;

export const CollectionDef = z
  .strictObject({
    key: CollectionKey,
    title: z.string().min(1).max(60),
    description: z.string().max(200).optional(),
    fields: z.array(FieldDef).min(1).max(30),
    titleField: FieldKey,
    statusField: FieldKey.optional(),
    dateField: FieldKey.optional(),
  })
  .superRefine((def, ctx) => {
    const keys = new Set<string>();
    for (const f of def.fields) {
      if (keys.has(f.key)) ctx.addIssue({ code: 'custom', message: `duplicate field "${f.key}"`, path: ['fields'] });
      keys.add(f.key);
      if (f.type === 'status' && !f.options?.length) {
        ctx.addIssue({ code: 'custom', message: `status field "${f.key}" needs "options"`, path: ['fields'] });
      }
    }
    for (const ref of ['titleField', 'statusField', 'dateField'] as const) {
      const v = def[ref];
      if (v && !keys.has(v)) ctx.addIssue({ code: 'custom', message: `${ref} "${v}" is not a field`, path: [ref] });
    }
  });
export type CollectionDef = z.infer<typeof CollectionDef>;

const isoDate = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), 'expected an ISO date like 2026-10-06');

function fieldSchema(f: FieldDef): z.ZodType {
  switch (f.type) {
    case 'text':
    case 'person':
    case 'phone':
      return z.string().max(500);
    case 'longtext':
      return z.string().max(20000);
    case 'number':
    case 'currency':
    case 'percent':
      return z.coerce.number();
    case 'date':
    case 'datetime':
      return isoDate;
    case 'url':
      return z.string().max(2000).refine((s) => /^https?:\/\//i.test(s) || s.startsWith('mailto:'), 'expected a URL');
    case 'email':
      return z.string().max(320).refine((s) => s.includes('@'), 'expected an email');
    case 'status':
      return f.options?.length ? z.enum(f.options as [string, ...string[]]) : z.string().max(40);
    case 'tags':
      return z.union([z.array(z.string().max(60)).max(30), z.string().transform((s) => s.split(',').map((t) => t.trim()).filter(Boolean))]);
    case 'boolean':
      return z.union([z.boolean(), z.enum(['true', 'false']).transform((s) => s === 'true')]);
  }
}

/** Builds the Zod schema for one record of a collection. Unknown fields are rejected. */
export function recordSchema(def: CollectionDef, { partial = false } = {}) {
  const shape: Record<string, z.ZodType> = {};
  for (const f of def.fields) {
    const s = fieldSchema(f);
    shape[f.key] = f.key === def.titleField && !partial ? s : s.optional().nullable();
  }
  return z.strictObject(shape);
}

export type RecordData = Record<string, unknown>;
