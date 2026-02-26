import { createContext, useContext, useState, useCallback, useRef } from "react";
import { usePartyScrape, useLotScrape, useUpdateItemStatus } from "./use-scraping";
import { useToast } from "./use-toast";
import { generateVariationsStrict } from "@/lib/name-variations";
import { CountySetting } from "@shared/schema";

type BatchType = "party" | "lot" | "unified" | null;

interface BatchScrapeContextType {
    isBatching: boolean;
    batchType: BatchType;
    processingIds: number[];
    totalItems: number;
    processedItems: number;
    totalVariations: number;
    processedVariations: number;
    startBatch: (type: BatchType, items: any[], selectedVariations?: Record<string, string[]>) => Promise<void>;
    stopBatch: () => void;
}

const BatchScrapeContext = createContext<BatchScrapeContextType | undefined>(undefined);

export function BatchScrapeProvider({ children }: { children: React.ReactNode }) {
    const [isBatching, setIsBatching] = useState(false);
    const [batchType, setBatchType] = useState<BatchType>(null);
    const [processingIds, setProcessingIds] = useState<number[]>([]);
    const [stats, setStats] = useState({ totalItems: 0, processedItems: 0, totalVariations: 0, processedVariations: 0 });
    const stopBatchRef = useRef(false);
    const { toast } = useToast();

    const partyScrape = usePartyScrape();
    const lotScrape = useLotScrape();
    const updateStatus = useUpdateItemStatus();

    const stopBatch = useCallback(() => {
        stopBatchRef.current = true;
        setIsBatching(false);
        setBatchType(null);
        setProcessingIds([]);
        setStats({ totalItems: 0, processedItems: 0, totalVariations: 0, processedVariations: 0 });
    }, []);

    const startBatch = useCallback(async (type: BatchType, items: any[], selectedVariations?: Record<string, string[]>) => {
        setIsBatching(true);
        setBatchType(type);
        stopBatchRef.current = false;

        const ids = items.map(i => i.id);
        setProcessingIds(ids);

        // Fetch settings once for the whole batch to avoid redundant calls
        const settingsRes = await fetch("/api/county-settings");
        const allSettings: CountySetting[] = await settingsRes.json();

        // 1. PRE-CALCULATE TOTAL VARIATIONS FOR SUMMARY
        let estimatedTotalVariations = 0;
        const itemsWithVariations = items.map(item => {
            const countyName = (item.data["County"] || "").toUpperCase();
            const countySetting = allSettings.find(s => s.name.toUpperCase() === countyName);
            const shouldScrapeParty = countySetting ? countySetting.scrapeParty === 1 : true;
            const shouldScrapeLot = countySetting ? countySetting.scrapeLot === 1 : true;

            const variations: { field: string, variation: string }[] = [];
            if ((type === "party" || type === "unified") && shouldScrapeParty) {
                const partyFieldRegex = /party.*name/i;
                const detectedFields = Object.keys(item.data).filter(key => partyFieldRegex.test(key));

                detectedFields.forEach(field => {
                    const selectionKey = `${item.id}-${field}`;
                    const userSelections = selectedVariations?.[selectionKey];
                    if (userSelections !== undefined) {
                        userSelections.forEach(v => variations.push({ field, variation: v }));
                    } else {
                        const rawName = item.data[field];
                        if (rawName && String(rawName).trim() !== '-' && String(rawName).trim() !== 'undefined') {
                            const vars = generateVariationsStrict(rawName);
                            vars.forEach(v => variations.push({ field, variation: v }));
                        }
                    }
                });
            }
            estimatedTotalVariations += variations.length;
            return { ...item, calculatedVariations: variations, countySetting, shouldScrapeLot };
        });

        setStats({
            totalItems: items.length,
            processedItems: 0,
            totalVariations: estimatedTotalVariations,
            processedVariations: 0
        });

        await Promise.allSettled(itemsWithVariations.map(async (item) => {
            if (stopBatchRef.current) return;

            const { countySetting, calculatedVariations, shouldScrapeLot } = item;
            const countyName = (item.data["County"] || "").toUpperCase();

            // 0. Set to processing immediately (Unified sync)
            try {
                await updateStatus.mutateAsync({ id: item.id, status: 'processing' });
            } catch (e) {
                console.error(`[Batch] Failed to set initial processing status for #${item.id}`);
            }

            // PHASE 1: Lot Scrape
            if ((type === "lot" || type === "unified") && shouldScrapeLot) {
                try {
                    console.log(`[Batch] Starting Lot Scrape for #${item.id} (${countyName})`);
                    await lotScrape.mutateAsync(item.id);
                } catch (error) {
                    console.error(`[Batch] Phase 1 (Lot) failed for #${item.id}:`, error);
                }
            } else if (shouldScrapeLot === false) {
                // Explicitly mark Lot as completed (skipped) in DB
                try {
                    await updateStatus.mutateAsync({ id: item.id, status: 'processing', lotStatus: 'completed' });
                } catch (e) { }
            }

            // PHASE 2: Party Scrape
            if ((type === "party" || type === "unified") && calculatedVariations.length > 0) {
                // Variations in Parallel
                await Promise.allSettled(calculatedVariations.map(async (vInfo: { field: string, variation: string }) => {
                    if (stopBatchRef.current) return;
                    try {
                        await partyScrape.mutateAsync({
                            id: item.id,
                            selectedVariations: { [`${item.id}-${vInfo.field}`]: [vInfo.variation] }
                        });
                    } catch (error) {
                        console.error(`[Batch] Phase 2 (Party) variation failed for #${item.id}:`, error);
                    } finally {
                        setStats(prev => ({ ...prev, processedVariations: prev.processedVariations + 1 }));
                    }
                }));
            }

            // Final check on global status
            if (!stopBatchRef.current) {
                try {
                    await updateStatus.mutateAsync({ id: item.id, status: 'completed' });
                } catch (e) {
                    console.error(`[Batch] Final status update failed for #${item.id}`);
                }
            }

            setProcessingIds(prev => prev.filter(id => id !== item.id));
            setStats(prev => ({ ...prev, processedItems: prev.processedItems + 1 }));
        }));

        setIsBatching(false);
        setBatchType(null);
        setProcessingIds([]);

        if (!stopBatchRef.current) {
            toast({ title: "Batch Complete", description: `Finished processing ${items.length} items with ${estimatedTotalVariations} variations.` });
        }
    }, [partyScrape, lotScrape, updateStatus, toast]);

    return (
        <BatchScrapeContext.Provider value={{
            isBatching,
            batchType,
            processingIds,
            ...stats,
            startBatch,
            stopBatch
        }}>
            {children}
        </BatchScrapeContext.Provider>
    );
}

export function useBatchScrape() {
    const context = useContext(BatchScrapeContext);
    if (context === undefined) {
        throw new Error("useBatchScrape must be used within a BatchScrapeProvider");
    }
    return context;
}
