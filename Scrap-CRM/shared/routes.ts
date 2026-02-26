import { z } from 'zod';
import { insertScrapeItemSchema, scrapeItems, uploads } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  uploads: {
    create: {
      method: 'POST' as const,
      path: '/api/uploads' as const,
      // Input is multipart/form-data, not validated here directly by Zod in the same way
      responses: {
        201: z.object({ message: z.string(), uploadId: z.number(), count: z.number() }),
        400: errorSchemas.validation,
      },
    },
    list: {
      method: 'GET' as const,
      path: '/api/uploads' as const,
      responses: {
        200: z.array(z.custom<typeof uploads.$inferSelect>()),
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/uploads/:id' as const,
      responses: {
        200: z.object({ message: z.string() }),
        404: errorSchemas.notFound,
      },
    }
  },
  scrapeItems: {
    list: {
      method: 'GET' as const,
      path: '/api/items' as const,
      input: z.object({
        uploadId: z.string().optional(),
        status: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof scrapeItems.$inferSelect>()),
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/items/:id' as const,
      responses: {
        200: z.object({ message: z.string() }),
        404: errorSchemas.notFound,
      },
    },
    updateStatus: {
      method: 'PATCH' as const,
      path: '/api/items/:id/status' as const,
      input: z.object({
        status: z.enum(["pending", "processing", "completed", "failed"]),
        result: z.string().optional(),
        lotStatus: z.enum(["pending", "processing", "completed", "failed"]).optional(),
        partyStatus: z.enum(["pending", "processing", "completed", "failed"]).optional(),
      }),
      responses: {
        200: z.custom<typeof scrapeItems.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    startAll: {
      method: 'POST' as const,
      path: '/api/items/start-all' as const,
      input: z.object({
        uploadId: z.number().optional(), // Optional: start specific upload batch
      }),
      responses: {
        200: z.object({ message: z.string(), count: z.number() }),
      },
    },
    startWebhook: {
      method: 'POST' as const,
      path: '/api/scrape-items/start-webhook' as const,
      input: z.object({
        id: z.number(),
        selectedVariations: z.record(z.string(), z.array(z.string())).optional()
      }),
      responses: {
        200: z.object({ message: z.string(), count: z.number() }),
      },
    },
    partyScrape: {
      method: 'POST' as const,
      path: '/api/scrape-items/party-scrape' as const,
      input: z.object({
        id: z.number(),
        selectedVariations: z.record(z.string(), z.array(z.string())).optional()
      }),
      responses: {
        200: z.object({ status: z.string(), total_downloaded: z.number().optional() }),
      },
    },
    lotScrape: {
      method: 'POST' as const,
      path: '/api/scrape-items/lot-scrape' as const,
      input: z.object({
        id: z.number(),
      }),
      responses: {
        200: z.object({ status: z.string(), file_count: z.number().optional() }),
      },
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
