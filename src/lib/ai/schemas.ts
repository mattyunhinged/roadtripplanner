import { z } from 'zod';

export const draftStopSchema = z.object({
  name: z.string().min(1),
  category: z
    .enum([
      'origin',
      'destination',
      'food',
      'lodging',
      'attraction',
      'scenic',
      'fuel',
      'custom',
    ])
    .catch('custom'),
  dayIndex: z.coerce.number().int().min(0).default(0),
  order: z.coerce.number().int().min(0).default(0),
  searchQuery: z.string().min(1),
  approximateLocation: z
    .object({
      lat: z.coerce.number(),
      lng: z.coerce.number(),
    })
    .optional(),
  timeWindow: z.string().optional(),
  costEstimate: z.coerce.number().optional(),
  aiNotes: z.string().optional(),
  isSideQuest: z.boolean().optional().default(false),
});

export const draftDaySchema = z.object({
  index: z.coerce.number().int().min(0),
  title: z.string().min(1),
  summary: z.string().optional(),
  date: z.string().optional(),
});

export const draftTripSchema = z.object({
  title: z.string().min(1),
  vibe: z.string().default(''),
  totalDays: z.coerce.number().int().min(1).max(90),
  originQuery: z.string().optional(),
  destinationQueries: z.array(z.string()).default([]),
  roundTrip: z.boolean().default(true),
  days: z.array(draftDaySchema).default([]),
  stops: z.array(draftStopSchema).default([]),
  budgetNotes: z.string().optional(),
  assumedMpg: z.coerce.number().optional(),
  progressHints: z.array(z.string()).optional(),
});

/** Lightweight outline before stop batches (supports massive trips). */
export const tripOutlineSchema = z.object({
  title: z.string().min(1),
  vibe: z.string().default(''),
  totalDays: z.coerce.number().int().min(1).max(90),
  originQuery: z.string().min(1),
  destinationQueries: z.array(z.string()).default([]),
  roundTrip: z.boolean().default(true),
  days: z.array(draftDaySchema).min(1),
  budgetNotes: z.string().optional(),
  assumedMpg: z.coerce.number().optional(),
  progressHints: z.array(z.string()).optional(),
});

export const stopBatchSchema = z.object({
  stops: z.array(draftStopSchema).min(1),
});

export const tripEditResponseSchema = z.object({
  message: z.string(),
  action: z.enum(['reply', 'patch', 'replace']).default('reply'),
  title: z.string().optional(),
  vibe: z.string().optional(),
  stopsToAdd: z.array(draftStopSchema).optional(),
  stopIdsToRemove: z.array(z.string()).optional(),
  stopUpdates: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        category: draftStopSchema.shape.category.optional(),
        timeWindow: z.string().optional(),
        costEstimate: z.number().optional(),
        aiNotes: z.string().optional(),
        searchQuery: z.string().optional(),
        dayIndex: z.number().optional(),
        order: z.number().optional(),
        isSideQuest: z.boolean().optional(),
      }),
    )
    .optional(),
  reorder: z
    .array(
      z.object({
        dayIndex: z.number(),
        stopIds: z.array(z.string()),
      }),
    )
    .optional(),
  packingList: z
    .array(
      z.object({
        label: z.string(),
        category: z.string(),
      }),
    )
    .optional(),
  fullTrip: draftTripSchema.optional(),
});

export const packingListSchema = z.object({
  items: z.array(
    z.object({
      label: z.string(),
      category: z.string(),
    }),
  ),
});

export type DraftTrip = z.infer<typeof draftTripSchema>;
export type DraftStop = z.infer<typeof draftStopSchema>;
export type TripOutline = z.infer<typeof tripOutlineSchema>;
export type TripEditResponse = z.infer<typeof tripEditResponseSchema>;
