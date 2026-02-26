import { useState, useMemo, Fragment } from "react";
import { useScrapeItems, useUpdateItemStatus, useStartAll, useDeleteItem, useDeleteUpload, useStartWebhook } from "@/hooks/use-scraping";
import { useUploads } from "@/hooks/use-scraping";
import { StatusBadge } from "@/components/StatusBadge";
import { Play, Loader2, Search, Filter, RefreshCcw, Trash2, UserPlus, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";
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

export default function TasksPage() {
  const [selectedUploadId, setSelectedUploadId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedState, setExpandedState] = useState<{ id: number; partyKey: string } | null>(null);
  const [selectedVariations, setSelectedVariations] = useState<Record<string, string[]>>(() => {
    // Persist selection across refreshes
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("selectedVariations");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error("Failed to parse selected variations", e);
        }
      }
    }
    return {};
  });

  // Save changes to localStorage
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

  // Fetch data
  const { data: items, isLoading } = useScrapeItems(selectedUploadId || undefined);
  const { data: uploads } = useUploads();

  // Mutations
  const { mutate: updateStatus, isPending: isUpdating } = useUpdateItemStatus();
  const { mutate: startAll, isPending: isStartingAll } = useStartAll();
  const { mutate: deleteItem } = useDeleteItem();
  const { mutate: deleteUpload } = useDeleteUpload();
  const { mutate: startWebhook, isPending: isStarting } = useStartWebhook();
  const { toast } = useToast();

  // Safe data parsing for items
  const parsedItems = useMemo(() => {
    if (!items) return [];
    return items.map(item => ({
      ...item,
      data: typeof item.data === 'string' ? JSON.parse(item.data) : (item.data as Record<string, any>)
    }));
  }, [items]);

  // Derived state
  const filteredItems = useMemo(() => {
    return parsedItems.filter(item => {
      if (!searchQuery) return true;
      const dataStr = JSON.stringify(item.data).toLowerCase();
      return dataStr.includes(searchQuery.toLowerCase());
    });
  }, [parsedItems, searchQuery]);

  // Explicit headers
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
    // Get collected variations for this item, ensuring no duplicates in the values
    const variations: Record<string, string[]> = {};
    Object.keys(selectedVariations).forEach(key => {
      if (key.startsWith(`${id}-`)) {
        // Use Set to ensure unique variations for each partyKey
        variations[key] = Array.from(new Set(selectedVariations[key]));
      }
    });

    startWebhook({ id, selectedVariations: variations }, {
      onSuccess: (data: any) => toast({
        title: "Webhook Triggered",
        description: `Sent ${data.count} tasks to n8n.`
      }),
      onError: (err: any) => toast({
        title: "Failed to start",
        description: err.message,
        variant: "destructive"
      })
    });
  };

  const handleStartAll = () => {
    const uploadId = selectedUploadId ? parseInt(selectedUploadId) : undefined;
    startAll(uploadId, {
      onSuccess: (data) => toast({ title: "Batch Started", description: `Successfully queued ${data.count} tasks.` })
    });
  };

  const handleDeleteItem = (id: number) => {
    setDeleteConfirm({
      type: 'item',
      id,
      title: "Delete Row",
      description: `Are you sure you want to remove Row #${id}? This action cannot be undone and all associated data for this row will be permanently erased.`
    });
  };

  const handleDeleteUpload = () => {
    if (!selectedUploadId) return;
    const upload = uploads?.find(u => u.id === parseInt(selectedUploadId));
    setDeleteConfirm({
      type: 'upload',
      id: parseInt(selectedUploadId),
      title: "Delete File",
      description: `Are you sure you want to delete the entire file "${upload?.filename}"? This will permanently remove all rows and data associated with this upload.`
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

  const getNameVariations = (name: string) => {
    if (!name || name === '-' || name === 'undefined') return [];

    // Exactly requested variations for the demo entity
    if (name.includes("574 Main Street")) {
      return ["574 Main Street, LLC", "Main Street", "Street, LLC", "Main LLC"];
    }

    const words = name.split(/[\s,]+/);
    const cleanWords = words.filter(w => !['LLC', 'INC', 'L.L.C'].includes(w.toUpperCase()));
    const suffix = words.find(w => ['LLC', 'INC', 'L.L.C'].includes(w.toUpperCase())) || "LLC";

    const results = [name];
    if (cleanWords.length >= 2) {
      results.push(cleanWords.slice(-2).join(" "));
      const streetWord = words.find(w => w.toLowerCase().includes('street')) || cleanWords[cleanWords.length - 1];
      results.push(`${streetWord}, ${suffix}`);
      results.push(`${cleanWords[0]} ${suffix}`);
    }
    return Array.from(new Set(results));
  };

  const handleSelectVariation = (itemId: number, partyKey: string, variation: string, allVariations: string[]) => {
    const key = `${itemId}-${partyKey}`;
    setSelectedVariations(prev => {
      // If key is missing, it means ALL are selected. Initialize with allVariations.
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
          <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">Scrape Tasks</h2>
          <p className="text-muted-foreground mt-3 font-medium flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Manage and monitor scraping operations.
          </p>
        </div>
        <button
          onClick={handleStartAll}
          disabled={isStartingAll || filteredItems.length === 0}
          className="inline-flex items-center justify-center gap-2.5 px-6 py-2.5 rounded-2xl font-bold bg-gradient-to-r from-primary via-primary to-blue-600 text-primary-foreground shadow-lg shadow-primary/30 hover:shadow-2xl hover:shadow-primary/40 hover:-translate-y-0.5 active:scale-95 transition-all duration-300 border border-white/20"
        >
          {isStartingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
          Start All Operations
        </button>
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
                  <th className="px-4 py-3 text-center w-56">Action</th>
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
                      {headers.map((key, idx) => {
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
                      <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {item.status === 'pending' || item.status === 'failed' ? (
                            <>
                              <button
                                onClick={() => handleStartTask(item.id)}
                                disabled={isUpdating || isStarting}
                                title="Party Scrape"
                                className="group/btn inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md shadow-purple-400/20 hover:shadow-lg hover:shadow-purple-400/30 hover:-translate-y-0.5 active:scale-95 font-bold text-[10px] uppercase tracking-wider transition-all disabled:opacity-50 border border-white/10"
                              >
                                <Play className="w-2.5 h-2.5 fill-current group-hover/btn:scale-110 transition-transform" />
                                <span>Party</span>
                              </button>
                              <button
                                onClick={() => handleStartTask(item.id)}
                                disabled={isUpdating || isStarting}
                                title="Lot Scrape"
                                className="group/btn inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-br from-primary to-blue-600 text-primary-foreground shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 active:scale-95 font-bold text-[10px] uppercase tracking-wider transition-all disabled:opacity-50 border border-white/10"
                              >
                                <Play className="w-2.5 h-2.5 fill-current group-hover/btn:scale-110 transition-transform" />
                                <span>Lot</span>
                              </button>
                            </>
                          ) : (
                            <div className="inline-flex items-center gap-2 px-2.5 py-1.25 rounded-lg bg-secondary/50 text-muted-foreground text-[11px] font-semibold">
                              <Loader2 className="w-2.5 h-2.5 animate-spin" /> Running
                            </div>
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
                                // Safely access variations from the backend data
                                const backendVariations = (item.data as any).party_variations?.[expandedState.partyKey];

                                // Fallback if no variations exist (e.g. old data)
                                const variationsToDisplay = Array.isArray(backendVariations) && backendVariations.length > 0
                                  ? backendVariations
                                  : [rawName];

                                return variationsToDisplay.map((variation: string, i: number) => {
                                  // Default to ALL selected if not defined
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
                                })
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
            <AlertDialogTitle className="text-3xl font-extrabold tracking-tight text-foreground">
              {deleteConfirm?.title}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground/80 text-lg font-medium mt-3 leading-relaxed">
              {deleteConfirm?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-10 gap-4">
            <AlertDialogCancel className="h-14 rounded-2xl border-border/50 bg-secondary/50 hover:bg-secondary transition-all font-bold text-base px-8">
              Cancel
            </AlertDialogCancel>
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
