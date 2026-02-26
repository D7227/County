
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type ScrapeStatus } from "@shared/schema";

// Uploads
export function useUploads() {
  return useQuery({
    queryKey: [api.uploads.list.path],
    queryFn: async () => {
      const res = await fetch(api.uploads.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch uploads");
      return api.uploads.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateUpload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(api.uploads.create.path, {
        method: api.uploads.create.method,
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 400) {
          const error = api.uploads.create.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to upload file");
      }
      return api.uploads.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.uploads.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.scrapeItems.list.path] });
    },
  });
}

// Scrape Items
export function useScrapeItems(uploadId?: string, status?: string) {
  return useQuery({
    queryKey: [api.scrapeItems.list.path, { uploadId, status }],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (uploadId) params.uploadId = uploadId;
      if (status) params.status = status;

      const queryString = new URLSearchParams(params).toString();
      const url = `${api.scrapeItems.list.path}${queryString ? `?${queryString}` : ''}`;

      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch items");
      return api.scrapeItems.list.responses[200].parse(await res.json());
    },
    refetchInterval: 5000, // Poll every 5 seconds for updates
  });
}

export function useUpdateItemStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, result, lotStatus, partyStatus }: { id: number; status: ScrapeStatus; result?: string; lotStatus?: ScrapeStatus; partyStatus?: ScrapeStatus }) => {
      const url = buildUrl(api.scrapeItems.updateStatus.path, { id });
      const res = await fetch(url, {
        method: api.scrapeItems.updateStatus.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, result, lotStatus, partyStatus }),
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to update status");
      return api.scrapeItems.updateStatus.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.scrapeItems.list.path] });
    },
  });
}

export function useStartAll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (uploadId?: number) => {
      const res = await fetch(api.scrapeItems.startAll.path, {
        method: api.scrapeItems.startAll.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadId }),
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to start batch");
      return api.scrapeItems.startAll.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.scrapeItems.list.path] });
    },
  });
}

// Deletion Hooks
export function useDeleteItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.scrapeItems.delete.path, { id });
      const res = await fetch(url, { method: api.scrapeItems.delete.method, credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete item");
      return api.scrapeItems.delete.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.scrapeItems.list.path] });
    },
  });
}

export function useDeleteUpload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.uploads.delete.path, { id });
      const res = await fetch(url, { method: api.uploads.delete.method, credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete upload");
      return api.uploads.delete.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.uploads.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.scrapeItems.list.path] });
    },
  });
}

export function useStartWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, selectedVariations }: { id: number; selectedVariations?: Record<string, string[]> }) => {
      try {
        const res = await fetch(api.scrapeItems.startWebhook.path, {
          method: api.scrapeItems.startWebhook.method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, selectedVariations }),
          credentials: "include",
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Failed to trigger webhook: ${text}`);
        }
        return api.scrapeItems.startWebhook.responses[200].parse(await res.json());
      } catch (err: any) {
        console.error("Webhook error in hook:", err);
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.scrapeItems.list.path] });
    },
  });
}
export function useLotScrape() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(api.scrapeItems.lotScrape.path, {
        method: api.scrapeItems.lotScrape.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
        credentials: "include",
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Lot scrape failed: ${text}`);
      }
      return api.scrapeItems.lotScrape.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.scrapeItems.list.path] });
    },
  });
}

export function usePartyScrape() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, selectedVariations }: { id: number; selectedVariations?: Record<string, string[]> }) => {
      const res = await fetch(api.scrapeItems.partyScrape.path, {
        method: api.scrapeItems.partyScrape.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, selectedVariations }),
        credentials: "include",
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Party scrape failed: ${text}`);
      }
      return api.scrapeItems.partyScrape.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.scrapeItems.list.path] });
    },
  });
}
