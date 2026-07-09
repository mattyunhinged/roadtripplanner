import { z } from 'zod';

export const draftStopSchema = z.object({
  name: z.string(),
  category: z.enum([
    'origin',
    'destination',
    'food',
    'lodging',
    'attraction',
    'scenic',
    'fuel',
    'custom',
  ]),
  dayIndex: z.number().int().min(0),
  order: z.number().int().min(0),
  searchQuery: z.string(),
  approximateLocation: z
    .object({
      lat: z.number(),
      lng: z.number(),
    })
    .optional(),
  timeWindow: z.string().optional(),
  costEstimate: z.number().optional(),
  aiNotes: z.string().optional(),
});

export const draftDaySchema = z.object({
  index: z.number().int().min(0),
  title: z.string(),
  summary: z.string().optional(),
  date: z.string().optional(),
});

export const draftTripSchema = z.object({
  title: z.string(),
  vibe: z.string(),
  totalDays: z.number().int().min(1),
  originQuery: z.string().optional(),
  destinationQueries: z.array(z.string()).default([]),
  roundTrip: z.boolean().default(true),
  days: z.array(draftDaySchema),
  stops: z.array(draftStopSchema),
  budgetNotes: z.string().optional(),
  assumedMpg: z.number().optional(),
  progressHints: z.array(z.string()).optional(),
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
export type TripEditResponse = z.infer<typeof tripEditResponseSchema>;
