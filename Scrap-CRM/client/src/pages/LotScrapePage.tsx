import { useState, useMemo, Fragment, useRef } from "react";
import { useScrapeItems, useUpdateItemStatus, useDeleteItem, useDeleteUpload, useLotScrape, useStartAll } from "@/hooks/use-scraping";
import { useBatchScrape } from "@/hooks/use-batch-scrape";
import { useUploads } from "@/hooks/use-scraping";
import { StatusBadge } from "@/components/StatusBadge";
import { Play, Loader2, Search, Trash2, UserPlus, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function LotScrapePage() {
    const [selectedUploadId, setSelectedUploadId] = useState<string>("");
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedState, setExpandedState] = useState<{ id: number; partyKey: string } | null>(null);
    const [selectedVariations, setSelectedVariations] = useState<Record<string, string[]>>(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("selectedVariations");
            if (saved) {
                try { return JSON.parse(saved); } catch (e) { }
            }
        }
        return {};
    });

    useMemo(() => {
        if (Object.keys(selectedVariations).length > 0) {
            localStorage.setItem("selectedVariations", JSON.stringify(selectedVariations));
        }
    }, [selectedVariations]);

    const [deleteConfirm, setDeleteConfirm] = useState<{
        type: 'item' | 'upload';
        id: number;
        title: string;
        description: string;
    } | null>(null);

    const { data: items, isLoading } = useScrapeItems(selectedUploadId || undefined);
    const { data: uploads } = useUploads();
    const { isBatching, batchType, startBatch, stopBatch, currentId } = useBatchScrape();

    const [loadingId, setLoadingId] = useState<number | null>(null);
    const { mutate: updateStatus, isPending: isUpdating } = useUpdateItemStatus();
    const { mutate: startAll, isPending: isStartingAll } = useStartAll();
    const { mutate: deleteItem } = useDeleteItem();
    const { mutate: deleteUpload } = useDeleteUpload();
    const lotScrape = useLotScrape();
    const { toast } = useToast();

    const parsedItems = useMemo(() => {
        if (!items) return [];
        return items.map(item => ({
            ...item,
            data: typeof item.data === 'string' ? JSON.parse(item.data) : (item.data as Record<string, any>)
        }));
    }, [items]);

    const filteredItems = useMemo(() => {
        return parsedItems.filter(item => {
            if (!searchQuery) return true;
            const dataStr = JSON.stringify(item.data).toLowerCase();
            return dataStr.includes(searchQuery.toLowerCase());
        });
    }, [parsedItems, searchQuery]);

    const headers = useMemo(() => {
        if (!filteredItems.length) return [];
        const requiredHeaders = [
            "File Number", "State", "County", "Party Name 1", "Party Name 2", "Party Name 3", "Party Name 4",
            "Property Address", "Lot", "Block", "Township", "Prior Effective Date"
        ];
        const dataKeys = Object.keys(filteredItems[0].data);
        return requiredHeaders.map(req => dataKeys.find(k => k.toLowerCase() === req.toLowerCase()) || req);
    }, [filteredItems]);

    const handleStartTask = (id: number) => {
        setLoadingId(id);
        lotScrape.mutate(id, {
            onSuccess: (data: any) => toast({
                title: "Lot Scrape Triggered",
                description: `Backend status: ${data.status}`
            }),
            onError: (err: any) => toast({
                title: "Failed to start",
                description: err.message,
                variant: "destructive"
            }),
            onSettled: () => setLoadingId(null)
        });
    };

    const handleStartAll = () => {
        const itemsToScrape = filteredItems.filter(item => item.status !== 'completed' && item.status !== 'processing');
        if (itemsToScrape.length === 0) {
            toast({ title: "No items to scrape", description: "All filtered items are already completed or processing." });
            return;
        }
        startBatch("lot", itemsToScrape);
    };

    const handleStopAll = () => {
        stopBatch();
    };

    const handleDeleteItem = (id: number) => {
        setDeleteConfirm({
            type: 'item', id,
            title: "Delete Row",
            description: `Are you sure you want to remove Row #${id}? This action cannot be undone.`
        });
    };

    const handleDeleteUpload = () => {
        if (!selectedUploadId) return;
        const upload = uploads?.find(u => u.id === parseInt(selectedUploadId));
        setDeleteConfirm({
            type: 'upload', id: parseInt(selectedUploadId),
            title: "Delete File",
            description: `Are you sure you want to delete "${upload?.filename}"? This will permanently remove all rows.`
        });
    };

    const confirmDelete = () => {
        if (!deleteConfirm) return;
        if (deleteConfirm.type === 'item') {
            deleteItem(deleteConfirm.id, { onSuccess: () => toast({ title: "Deleted", description: `Row #${deleteConfirm.id} removed.` }) });
        } else {
            deleteUpload(deleteConfirm.id, {
                onSuccess: () => { setSelectedUploadId(""); toast({ title: "File deleted" }); }
            });
        }
        setDeleteConfirm(null);
    };

    const handleSelectVariation = (itemId: number, partyKey: string, variation: string, allVariations: string[]) => {
        const key = `${itemId}-${partyKey}`;
        setSelectedVariations(prev => {
            const current = prev[key] === undefined ? [...allVariations] : prev[key];
            const updated = current.includes(variation)
                ? current.filter(v => v !== variation)
                : [...current, variation];
            return { ...prev, [key]: updated };
        });
    };

    return (
        <div className="space-y-6 h-[calc(100vh-4rem)] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 flex-none">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">Lot / Block Scrape</h2>
                    <p className="text-muted-foreground mt-3 font-medium flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                        Manage and monitor lot/block-based scraping operations.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {isBatching && batchType === 'lot' ? (
                        <button
                            onClick={handleStopAll}
                            className="inline-flex items-center justify-center gap-2.5 px-6 py-2.5 rounded-2xl font-bold bg-white text-rose-600 shadow-lg shadow-rose-200 hover:shadow-xl hover:shadow-rose-300 hover:-translate-y-0.5 active:scale-95 transition-all duration-300 border border-rose-100"
                        >
                            <Trash2 className="w-4 h-4" />
                            Stop All Process
                        </button>
                    ) : (
                        <button
                            onClick={handleStartAll}
                            disabled={filteredItems.length === 0 || (isBatching && batchType === 'lot')}
                            className="inline-flex items-center justify-center gap-2.5 px-6 py-2.5 rounded-2xl font-bold bg-gradient-to-r from-primary via-primary to-blue-600 text-primary-foreground shadow-lg shadow-primary/30 hover:shadow-2xl hover:shadow-primary/40 hover:-translate-y-0.5 active:scale-95 transition-all duration-300 border border-white/20"
                        >
                            {isStartingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                            Start All Lot Scrapes
                        </button>
                    )}
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-3 p-3 glass rounded-2xl flex-none border-white/20">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search within data..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-10 pl-10 pr-4 py-2 rounded-xl bg-background border border-border/60 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={selectedUploadId}
                        onChange={(e) => setSelectedUploadId(e.target.value)}
                        className="h-10 px-3 rounded-xl bg-background border border-border/60 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all min-w-[180px]"
                    >
                        <option value="">All Uploads</option>
                        {uploads?.map(u => <option key={u.id} value={u.id}>{u.filename}</option>)}
                    </select>
                    {selectedUploadId && (
                        <button onClick={handleDeleteUpload} className="p-2.5 rounded-xl text-destructive hover:bg-destructive/10 bg-destructive/5 border border-destructive/10">
                            <Trash2 className="w-4.5 h-4.5" />
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-hidden glass rounded-2xl flex flex-col border-white/20">
                {isLoading ? (
                    <div className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                ) : (
                    <div className="flex-1 overflow-auto">
                        <table className="w-full min-w-max text-sm text-left">
                            <thead className="text-[11px] uppercase bg-white/40 text-muted-foreground font-bold sticky top-0 z-10 backdrop-blur-xl border-b border-white/10">
                                <tr>
                                    <th className="px-4 py-3 w-16 text-center">ID</th>
                                    {headers.map(key => <th key={key} className="px-4 py-3 whitespace-nowrap">{key}</th>)}
                                    <th className="px-4 py-3 w-28">Status</th>
                                    <th className="px-4 py-3 text-center w-40">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/40">
                                {filteredItems.map((item) => (
                                    <Fragment key={item.id}>
                                        <tr className={cn(
                                            "hover:bg-primary/[0.04] transition-all border-none text-foreground/90 group",
                                            expandedState?.id === item.id ? "bg-primary/[0.06]" : ""
                                        )}>
                                            <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground/80 text-center">#{item.id}</td>
                                            {headers.map((key) => {
                                                const val = String((item.data as any)[key] || '-');
                                                const isParty = key.toLowerCase().includes('party name');
                                                const hasVal = val !== '-' && val !== 'undefined';
                                                const isExpanded = expandedState?.id === item.id && expandedState?.partyKey === key;
                                                const selectedArray = selectedVariations[`${item.id}-${key}`] || [];
                                                const selectedVal = selectedArray.join(", ");

                                                return (
                                                    <td
                                                        key={`${item.id}-${key}`}
                                                        className={cn(
                                                            "px-4 py-3 min-w-[140px] whitespace-nowrap text-[13px] transition-colors relative",
                                                            isParty && hasVal ? "font-bold text-primary cursor-pointer hover:bg-primary/5" : "",
                                                            selectedArray.length > 0 ? "text-emerald-600 bg-emerald-50/30" : ""
                                                        )}
                                                        onClick={() => {
                                                            if (isParty && hasVal) {
                                                                setExpandedState(isExpanded ? null : { id: item.id, partyKey: key });
                                                            }
                                                        }}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            {isParty && hasVal && (
                                                                isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100" />
                                                            )}
                                                            <span className="truncate max-w-[200px]">{selectedVal || val}</span>
                                                            {selectedArray.length > 0 && <CheckCircle2 className="w-3 h-3 text-emerald-500 ml-auto flex-none" />}
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col gap-1">
                                                    <StatusBadge status={item.status} />
                                                    {item.result && (
                                                        <div className="flex flex-col gap-0.5 mt-1 ml-1">
                                                            {(() => {
                                                                try {
                                                                    const res = JSON.parse(item.result as string);
                                                                    const statusMsg = res.message || res.status;
                                                                    const downloadCount = res.file_count;
                                                                    return (
                                                                        <>
                                                                            {statusMsg && statusMsg !== 'success' && (
                                                                                <span className="text-[9px] font-bold text-muted-foreground leading-tight">
                                                                                    {statusMsg}
                                                                                </span>
                                                                            )}
                                                                            {item.status === 'completed' && downloadCount !== undefined && (
                                                                                <span className="text-[10px] font-bold text-emerald-600">
                                                                                    {downloadCount} files
                                                                                </span>
                                                                            )}
                                                                        </>
                                                                    );
                                                                } catch (e) { return null; }
                                                            })()}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    {(loadingId === item.id || (isBatching && batchType === 'lot' && currentId === item.id)) ? (
                                                        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-white text-blue-600 text-[10px] font-bold uppercase border border-blue-200 shadow-sm animate-pulse ring-2 ring-blue-500/5">
                                                            <Loader2 className="w-3 h-3 animate-spin" /> Starting...
                                                        </div>
                                                    ) : item.status === 'processing' ? (
                                                        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-amber-50 text-amber-600 text-[10px] font-bold uppercase border border-amber-200 ring-2 ring-amber-500/5">
                                                            <Loader2 className="w-3 h-3 animate-spin" /> Scraping
                                                        </div>
                                                    ) : item.status === 'completed' ? (
                                                        <button
                                                            onClick={() => handleStartTask(item.id)}
                                                            className="group/btn inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-2xl bg-white text-emerald-600 hover:bg-emerald-50 border border-emerald-200 shadow-sm hover:shadow-md transition-all font-bold text-[10px] uppercase tracking-wider"
                                                        >
                                                            <CheckCircle2 className="w-2.5 h-2.5" />
                                                            <span>Scrape Again</span>
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleStartTask(item.id)}
                                                            disabled={loadingId === item.id}
                                                            className="group/btn inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-2xl bg-gradient-to-br from-primary to-blue-600 text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 active:scale-95 font-bold text-[10px] uppercase tracking-wider transition-all disabled:opacity-50 border border-white/10"
                                                        >
                                                            <span>Lot Scrape</span>
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleDeleteItem(item.id)}
                                                        className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-all border border-transparent hover:border-destructive/20"
                                                        title="Delete Row"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>

                                        {expandedState?.id === item.id && (
                                            <tr className="bg-primary/[0.02] border-y border-primary/10">
                                                <td colSpan={headers.length + 3} className="px-12 py-6">
                                                    <div className="glass-darker rounded-2xl p-6 border-white/20 shadow-xl animate-in slide-in-from-top-4 duration-300">
                                                        <div className="flex items-center justify-between mb-6">
                                                            <div className="flex items-center gap-3">
                                                                <div className="p-2 bg-primary/10 rounded-xl text-primary"><UserPlus className="w-5 h-5" /></div>
                                                                <div>
                                                                    <h4 className="text-sm font-bold text-foreground">Perfect Variances</h4>
                                                                    <p className="text-[11px] text-muted-foreground font-medium">Verify variations for <span className="text-primary font-bold">{expandedState.partyKey}</span></p>
                                                                </div>
                                                            </div>
                                                            <button onClick={() => setExpandedState(null)} className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-all p-2 px-3 rounded-lg bg-white/40 border border-white/10">Close</button>
                                                        </div>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                                            {(() => {
                                                                const rawName = String((item.data as any)[expandedState.partyKey]);
                                                                const backendVariations = (item.data as any).party_variations?.[expandedState.partyKey];
                                                                const variationsToDisplay = Array.isArray(backendVariations) && backendVariations.length > 0 ? backendVariations : [rawName];

                                                                return variationsToDisplay.map((variation: string, i: number) => {
                                                                    const selectedArray = selectedVariations[`${item.id}-${expandedState.partyKey}`];
                                                                    const isSelected = selectedArray === undefined || selectedArray.includes(variation);

                                                                    return (
                                                                        <div
                                                                            key={i}
                                                                            className={cn(
                                                                                "flex items-center space-x-4 p-5 rounded-2xl transition-all border group cursor-pointer",
                                                                                isSelected ? "bg-primary/10 border-primary shadow-lg scale-[1.02]" : "bg-white/50 border-white/20 hover:border-primary/40 hover:bg-white/70"
                                                                            )}
                                                                            onClick={() => handleSelectVariation(item.id, expandedState.partyKey, variation, variationsToDisplay)}
                                                                        >
                                                                            <Checkbox
                                                                                id={`var-${item.id}-${i}`}
                                                                                checked={isSelected}
                                                                                onCheckedChange={() => handleSelectVariation(item.id, expandedState.partyKey, variation, variationsToDisplay)}
                                                                                className="transition-transform group-hover:scale-110"
                                                                            />
                                                                            <label className="text-sm font-bold text-foreground group-hover:text-primary transition-colors cursor-pointer leading-tight select-none">
                                                                                {variation}
                                                                            </label>
                                                                        </div>
                                                                    );
                                                                });
                                                            })()}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
                <AlertDialogContent className="bg-white/90 backdrop-blur-2xl border-white/50 rounded-[2.5rem] p-10 max-w-md animate-in zoom-in-95 duration-300 shadow-[0_32px_64px_-16px_rgba(221,83,53,0.15)] overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary via-blue-500 to-primary" />
                    <AlertDialogHeader>
                        <div className="w-20 h-20 bg-destructive/5 rounded-[2rem] flex items-center justify-center text-destructive mb-6 self-start transform -rotate-6 border border-destructive/10">
                            <Trash2 className="w-10 h-10" />
                        </div>
                        <AlertDialogTitle className="text-3xl font-extrabold tracking-tight text-foreground">{deleteConfirm?.title}</AlertDialogTitle>
                        <AlertDialogDescription className="text-muted-foreground/80 text-lg font-medium mt-3 leading-relaxed">{deleteConfirm?.description}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-10 gap-4">
                        <AlertDialogCancel className="h-14 rounded-2xl border-border/50 bg-secondary/50 hover:bg-secondary transition-all font-bold text-base px-8">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            className="h-14 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 transition-all font-bold text-base shadow-lg shadow-red-500/20 px-8 border-t border-white/20"
                        >
                            Confirm Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
