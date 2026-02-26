import { useState, useMemo, Fragment } from "react";
import { useScrapeItems, useDeleteItem, useDeleteUpload, useUploads } from "@/hooks/use-scraping";
import { useBatchScrape } from "@/hooks/use-batch-scrape";
import { StatusBadge } from "@/components/StatusBadge";
import { Play, Loader2, Search, Trash2, ChevronDown, ChevronUp, CheckCircle2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { generateVariationsStrict } from "@/lib/name-variations";
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

export default function UnifiedScrapePage() {
    const [selectedUploadId, setSelectedUploadId] = useState<string>("");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [expandedState, setExpandedState] = useState<{ id: number; partyKey: string } | null>(null);
    const [selectedVariations, setSelectedVariations] = useState<Record<string, string[]>>(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("unifiedVariations");
            if (saved) {
                try { return JSON.parse(saved); } catch (e) { }
            }
        }
        return {};
    });

    useMemo(() => {
        if (Object.keys(selectedVariations).length > 0) {
            localStorage.setItem("unifiedVariations", JSON.stringify(selectedVariations));
        }
    }, [selectedVariations]);

    const { data: items, isLoading } = useScrapeItems(selectedUploadId || undefined);
    const { data: uploads } = useUploads();
    const {
        isBatching,
        batchType,
        startBatch,
        stopBatch,
        processingIds,
        totalItems,
        processedItems,
        totalVariations,
        processedVariations
    } = useBatchScrape();

    const { mutate: deleteItem } = useDeleteItem();
    const { mutate: deleteUpload } = useDeleteUpload();
    const { toast } = useToast();

    const [deleteConfirm, setDeleteConfirm] = useState<{
        type: 'item' | 'upload';
        id: number;
        title: string;
        description: string;
    } | null>(null);

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

    const headers = [
        "File Number", "County", "Party Name 1", "Party Name 2", "Party Name 3", "Party Name 4",
        "Property Address", "Lot", "Block", "Township", "Prior Effective Date"
    ];

    const handleStartUnified = (item: any) => {
        // Use selections if they exist, otherwise use all generated
        const itemSelections: Record<string, string[]> = {};
        const partyFields = ["Party Name 1", "Party Name 2", "Party Name 3", "Party Name 4"];

        partyFields.forEach(field => {
            const key = `${item.id}-${field}`;
            if (selectedVariations[key]) {
                itemSelections[key] = selectedVariations[key];
            } else {
                const rawName = item.data[field];
                if (rawName && String(rawName).trim() !== '-' && String(rawName).trim() !== 'undefined') {
                    itemSelections[key] = generateVariationsStrict(rawName);
                }
            }
        });

        startBatch("unified", [item], itemSelections);
    };

    const handleStartAll = () => {
        const itemsToScrape = filteredItems.filter(item => item.status !== 'processing');
        if (itemsToScrape.length === 0) {
            toast({ title: "No items to action", description: "All filtered items are already processing." });
            return;
        }
        startBatch("unified", itemsToScrape, selectedVariations);
    };

    const handleStartSelected = () => {
        const itemsToScrape = filteredItems.filter(item => selectedIds.has(item.id) && item.status !== 'processing');
        if (itemsToScrape.length === 0) {
            toast({ title: "No items selected", description: "Please select rows that are not already processing." });
            return;
        }
        startBatch("unified", itemsToScrape, selectedVariations);
        setSelectedIds(new Set());
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredItems.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredItems.map(i => i.id)));
        }
    };

    const toggleSelect = (id: number) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
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

    const confirmDelete = () => {
        if (!deleteConfirm) return;
        if (deleteConfirm.type === 'item') {
            deleteItem(deleteConfirm.id, { onSuccess: () => toast({ title: "Deleted", description: `Row #${deleteConfirm.id} removed.` }) });
        } else {
            deleteUpload(deleteConfirm.id, {
                onSuccess: () => { setSelectedUploadId(""); toast({ title: "File deleted", description: "All associated records removed." }); }
            });
        }
        setDeleteConfirm(null);
    };

    return (
        <div className="space-y-6 h-[calc(100vh-4rem)] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 flex-none">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary via-indigo-600 to-blue-600 bg-clip-text text-transparent">Unified Scrape Data</h2>
                    <p className="text-muted-foreground mt-3 font-medium flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                        One-click full processing (Lot + Party Variations).
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {selectedIds.size > 0 && !isBatching && (
                        <button
                            onClick={handleStartSelected}
                            className="inline-flex items-center justify-center gap-2.5 px-6 py-2.5 rounded-2xl font-bold bg-emerald-500 text-white shadow-lg shadow-emerald-200 hover:shadow-xl hover:shadow-emerald-300 hover:-translate-y-0.5 active:scale-95 transition-all duration-300 border border-emerald-400"
                        >
                            <Zap className="w-4 h-4 fill-current" />
                            Scrape Selected ({selectedIds.size})
                        </button>
                    )}
                    {isBatching && batchType === 'unified' ? (
                        <button
                            onClick={stopBatch}
                            className="inline-flex items-center justify-center gap-2.5 px-6 py-2.5 rounded-2xl font-bold bg-white text-rose-600 shadow-lg shadow-rose-200 hover:shadow-xl hover:shadow-rose-300 hover:-translate-y-0.5 active:scale-95 transition-all duration-300 border border-rose-100"
                        >
                            <Trash2 className="w-4 h-4" />
                            Stop Processing
                        </button>
                    ) : (
                        <button
                            onClick={handleStartAll}
                            disabled={filteredItems.length === 0}
                            className="inline-flex items-center justify-center gap-2.5 px-6 py-2.5 rounded-2xl font-bold bg-gradient-to-r from-primary via-indigo-600 to-blue-600 text-primary-foreground shadow-lg shadow-primary/30 hover:shadow-2xl hover:shadow-primary/40 hover:-translate-y-0.5 active:scale-95 transition-all duration-300 border border-white/20"
                        >
                            <Play className="w-4 h-4 fill-current" />
                            Start All Scrapes
                        </button>
                    )}
                </div>
            </div>

            {isBatching && (
                <div className="p-6 glass-darker rounded-[2rem] border-primary/20 shadow-2xl animate-in zoom-in-95 duration-500 flex-none mb-4">
                    <div className="flex flex-col md:flex-row gap-8 items-center">
                        <div className="flex-1 w-full space-y-4">
                            <div className="flex justify-between items-end">
                                <div className="space-y-1">
                                    <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                                        Batch Processing Active
                                    </h3>
                                    <p className="text-sm text-muted-foreground font-medium">Respecting county settings & dynamic variations</p>
                                </div>
                                <div className="text-right">
                                    <span className="text-3xl font-black font-mono text-primary leading-none">
                                        {Math.round((processedVariations / (totalVariations || 1)) * 100)}%
                                    </span>
                                    <span className="text-xs font-bold text-muted-foreground block uppercase tracking-tighter">Total Progress</span>
                                </div>
                            </div>

                            <div className="h-4 w-full bg-primary/10 rounded-full overflow-hidden border border-primary/5 p-0.5 shadow-inner">
                                <div
                                    className="h-full bg-gradient-to-r from-primary via-indigo-500 to-blue-500 rounded-full transition-all duration-1000 ease-out shadow-lg"
                                    style={{ width: `${(processedVariations / (totalVariations || 1)) * 100}%` }}
                                />
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <div className="p-3 bg-white/40 rounded-2xl border border-white/20">
                                    <div className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">Rows</div>
                                    <div className="text-lg font-black text-foreground">{processedItems} / {totalItems}</div>
                                </div>
                                <div className="p-3 bg-white/40 rounded-2xl border border-white/20">
                                    <div className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">Variations</div>
                                    <div className="text-lg font-black text-foreground">{processedVariations} / {totalVariations}</div>
                                </div>
                                <div className="p-3 bg-white/40 rounded-2xl border border-white/20">
                                    <div className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">Queue</div>
                                    <div className="text-lg font-black text-foreground">{processingIds.length} Active</div>
                                </div>
                                <div className="p-3 bg-white/40 rounded-2xl border border-white/20">
                                    <div className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">Mode</div>
                                    <div className="text-lg font-black text-primary capitalize">{batchType}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col md:flex-row gap-3 p-3 glass rounded-2xl flex-none border-white/20">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search within records..."
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
                        {uploads?.map(u => <option key={u.id} value={u.id.toString()}>{u.filename}</option>)}
                    </select>
                    {selectedUploadId && (
                        <button onClick={() => setDeleteConfirm({ type: 'upload', id: parseInt(selectedUploadId), title: "Delete Upload", description: "This will remove all rows associated with this file." })} className="p-2.5 rounded-xl text-destructive hover:bg-destructive/10 bg-destructive/5 border border-destructive/10 transition-all">
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
                                    <th className="px-4 py-3 w-12 text-center">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.size === filteredItems.length && filteredItems.length > 0}
                                            onChange={toggleSelectAll}
                                            className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                                        />
                                    </th>
                                    <th className="px-4 py-3 w-16 text-center">ID</th>
                                    {headers.map(key => <th key={key} className="px-4 py-3 whitespace-nowrap">{key}</th>)}
                                    <th className="px-4 py-3 w-28">Lot</th>
                                    <th className="px-4 py-3 w-28">Party</th>
                                    <th className="px-4 py-3 text-center w-40">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/40">
                                {filteredItems.map((item) => (
                                    <Fragment key={item.id}>
                                        <tr className={cn(
                                            "hover:bg-primary/[0.04] transition-all border-none text-foreground/90 group",
                                            expandedState?.id === item.id ? "bg-primary/[0.06]" : "",
                                            selectedIds.has(item.id) ? "bg-emerald-50/10" : ""
                                        )}>
                                            <td className="px-4 py-3 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.has(item.id)}
                                                    onChange={() => toggleSelect(item.id)}
                                                    className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                                                />
                                            </td>
                                            <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground/80 text-center">#{item.id}</td>
                                            {headers.map(key => {
                                                const val = String(item.data[key] || '-');
                                                const isParty = key.toLowerCase().includes('party name');
                                                const hasVal = val !== '-' && val !== 'undefined' && val.trim() !== '';
                                                const isExpanded = expandedState?.id === item.id && expandedState?.partyKey === key;
                                                const selectedArray = selectedVariations[`${item.id}-${key}`] || [];

                                                return (
                                                    <td
                                                        key={key}
                                                        className={cn(
                                                            "px-4 py-3 min-w-[140px] whitespace-nowrap text-[13px] relative cursor-default",
                                                            isParty && hasVal ? "font-bold text-primary hover:bg-primary/5 cursor-pointer" : "",
                                                            selectedArray.length > 0 ? "text-emerald-600 bg-emerald-50/20" : ""
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
                                                            <span className="truncate max-w-[200px]">{val}</span>
                                                            {isParty && hasVal && (
                                                                <div className="text-[9px] text-muted-foreground font-medium flex items-center gap-1 mt-0.5 ml-auto">
                                                                    <Zap className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                                                                    {generateVariationsStrict(val).length}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                            <td className="px-4 py-3">
                                                <StatusBadge status={item.lotStatus || 'pending'} />
                                            </td>
                                            <td className="px-4 py-3">
                                                <StatusBadge status={item.partyStatus || 'pending'} />
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    {(isBatching && processingIds.includes(item.id)) ? (
                                                        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-primary text-primary-foreground text-[10px] font-bold uppercase shadow-lg shadow-primary/20 animate-pulse">
                                                            <Loader2 className="w-3 h-3 animate-spin" /> Working...
                                                        </div>
                                                    ) : item.status === 'processing' ? (
                                                        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-amber-50 text-amber-600 text-[10px] font-bold uppercase border border-amber-200 shadow-sm ring-1 ring-amber-500/20">
                                                            <Loader2 className="w-3 h-3 animate-spin" /> All Working
                                                        </div>
                                                    ) : item.status === 'completed' ? (
                                                        <button
                                                            onClick={() => handleStartUnified(item)}
                                                            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-2xl bg-white text-emerald-600 hover:bg-emerald-50 border border-emerald-200 shadow-sm hover:shadow-md transition-all font-bold text-[10px] uppercase tracking-wider"
                                                        >
                                                            <CheckCircle2 className="w-3 h-3" />
                                                            <span>Scrape Again</span>
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleStartUnified(item)}
                                                            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-2xl bg-gradient-to-br from-primary to-indigo-600 text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 active:scale-95 font-bold text-[10px] uppercase tracking-wider transition-all border border-white/10"
                                                        >
                                                            <span>Scrape Data</span>
                                                        </button>
                                                    )}

                                                    <button
                                                        onClick={() => setDeleteConfirm({
                                                            type: 'item',
                                                            id: item.id,
                                                            title: "Delete Record",
                                                            description: "Are you sure you want to permanently delete this row? This action cannot be undone."
                                                        })}
                                                        disabled={isBatching && processingIds.includes(item.id)}
                                                        className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 hover:text-rose-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed border border-transparent hover:border-rose-100"
                                                        title="Delete Record"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>

                                        {expandedState?.id === item.id && (
                                            <tr className="bg-primary/[0.02] border-y border-primary/10">
                                                <td colSpan={headers.length + 3} className="px-12 py-6">
                                                    <div className="glass-darker rounded-[2rem] p-8 border-white/20 shadow-2xl animate-in slide-in-from-top-4 duration-300">
                                                        <div className="flex items-center justify-between mb-8">
                                                            <div className="flex items-center gap-4">
                                                                <div className="p-3 bg-primary/10 rounded-2xl text-primary"><Zap className="w-6 h-6 fill-current" /></div>
                                                                <div>
                                                                    <h4 className="text-lg font-bold text-foreground">Verified Variances</h4>
                                                                    <p className="text-xs text-muted-foreground font-medium">All variations are <span className="text-primary font-bold italic underline">selected by default</span> for maximum reach.</p>
                                                                </div>
                                                            </div>
                                                            <button onClick={() => setExpandedState(null)} className="h-10 px-6 rounded-xl bg-white/40 border border-white/10 text-xs font-bold uppercase tracking-widest hover:bg-white/60 transition-all">Close</button>
                                                        </div>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                                            {(() => {
                                                                const rawText = String(item.data[expandedState.partyKey]);
                                                                const variations = generateVariationsStrict(rawText);

                                                                return variations.map((v, idx) => {
                                                                    const selectedArray = selectedVariations[`${item.id}-${expandedState.partyKey}`];
                                                                    const isSelected = selectedArray === undefined || selectedArray.includes(v);

                                                                    return (
                                                                        <div
                                                                            key={idx}
                                                                            className={cn(
                                                                                "flex items-center gap-4 p-5 rounded-2xl border transition-all cursor-pointer group",
                                                                                isSelected ? "bg-primary/10 border-primary" : "bg-white/50 border-white/10 opacity-60 hover:opacity-100"
                                                                            )}
                                                                            onClick={() => handleSelectVariation(item.id, expandedState.partyKey, v, variations)}
                                                                        >
                                                                            <div className={cn("w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all", isSelected ? "bg-primary border-primary" : "border-muted-foreground")}>
                                                                                {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white stroke-[3px]" />}
                                                                            </div>
                                                                            <span className="text-sm font-bold text-foreground tracking-tight">{v}</span>
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
                <AlertDialogContent className="bg-white/90 backdrop-blur-2xl rounded-[2.5rem] p-10 max-w-md shadow-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-2xl font-bold">{deleteConfirm?.title}</AlertDialogTitle>
                        <AlertDialogDescription className="text-muted-foreground mt-2">{deleteConfirm?.description}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-8 gap-3">
                        <AlertDialogCancel className="rounded-xl border-none bg-secondary/50 font-bold px-6">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 font-bold px-6">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div >
    );
}
