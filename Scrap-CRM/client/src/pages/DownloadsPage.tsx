
import { useState, useMemo } from "react";
import { Folder, FileText, Download, ChevronRight, Home, ArrowLeft, Eye, Search, Filter, Info, Loader2, Sparkles } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

interface FileEntry {
    name: string;
    isDirectory: boolean;
    path: string;
}

export default function DownloadsPage() {
    const [currentPath, setCurrentPath] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [extractionData, setExtractionData] = useState<any[] | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { toast } = useToast();

    // PDF Extraction Mutation
    const fetchDetailsMutation = useMutation({
        mutationFn: async (fileNumber: string) => {
            const res = await apiRequest("POST", "/api/extract-details", { fileNumber });
            return res.json();
        },
        onSuccess: (data) => {
            setExtractionData(data.results);
            setIsModalOpen(true);
            toast({
                title: "Extraction Complete",
                description: `Processed ${data.total_files} files for this folder. Results stored in DB.`,
            });
        },
        onError: (error: any) => {
            toast({
                title: "Extraction Failed",
                description: error.message || "Something went wrong during PDF processing.",
                variant: "destructive"
            });
        }
    });

    const isExtracting = fetchDetailsMutation.isPending;

    // Fetch current directory contents
    const { data: entries, isLoading, error } = useQuery<FileEntry[]>({
        queryKey: ["fs", currentPath],
        queryFn: async () => {
            const res = await fetch(`/api/fs/list?path=${encodeURIComponent(currentPath)}`);
            if (!res.ok) throw new Error("Failed to fetch directory");
            return res.json();
        }
    });

    // Fetch root directories (Counties) for the filter dropdown
    const { data: counties } = useQuery<FileEntry[]>({
        queryKey: ["fs", "root-counties"],
        queryFn: async () => {
            const res = await fetch(`/api/fs/list?path=`);
            if (!res.ok) throw new Error("Failed to fetch counties");
            const data = await res.json();
            return data.filter((d: any) => d.isDirectory);
        }
    });

    const filteredEntries = useMemo(() => {
        if (!entries) return [];
        if (!searchQuery) return entries;
        return entries.filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [entries, searchQuery]);

    const breadcrumbs = useMemo(() => {
        if (!currentPath) return [];
        const parts = currentPath.split("/");
        return parts.map((part, index) => ({
            name: part,
            path: parts.slice(0, index + 1).join("/")
        }));
    }, [currentPath]);

    const handleNavigate = (path: string) => {
        setCurrentPath(path);
        setSearchQuery(""); // Clear search on navigation
    };

    const handleDownload = (path: string, preview: boolean = false) => {
        const url = `/api/fs/download?path=${encodeURIComponent(path)}${preview ? '&preview=true' : ''}`;
        window.open(url, "_blank");
    };

    const handleUp = () => {
        if (!currentPath) return;
        const parts = currentPath.split("/");
        parts.pop();
        setCurrentPath(parts.join("/"));
        setSearchQuery("");
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 h-[calc(100vh-4rem)] flex flex-col">
            <div className="flex flex-col gap-4 flex-none">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">Downloads</h2>
                        <p className="text-muted-foreground mt-2 font-medium">Browse and download scraped files.</p>
                    </div>
                </div>

                {/* Filters & Navigation Bar */}
                <div className="flex flex-col md:flex-row gap-3 p-3 glass rounded-2xl border-white/20">
                    {/* Navigation */}
                    <div className="flex items-center gap-2 overflow-x-auto flex-1 min-w-0">
                        <Button variant="ghost" size="icon" onClick={() => setCurrentPath("")} disabled={!currentPath} className={!currentPath ? "opacity-50" : ""}>
                            <Home className="w-4 h-4" />
                        </Button>
                        {currentPath && <ChevronRight className="w-4 h-4 text-muted-foreground flex-none" />}

                        <div className="flex items-center gap-1 overflow-hidden">
                            {breadcrumbs.map((crumb, i) => (
                                <div key={crumb.path} className="flex items-center gap-1 whitespace-nowrap">
                                    <button
                                        onClick={() => handleNavigate(crumb.path)}
                                        className={cn(
                                            "text-sm font-medium hover:text-primary transition-colors px-2 py-1 rounded-md hover:bg-white/50 truncate max-w-[150px]",
                                            i === breadcrumbs.length - 1 ? "text-foreground font-bold" : "text-muted-foreground"
                                        )}
                                        title={crumb.name}
                                    >
                                        {crumb.name}
                                    </button>
                                    {i < breadcrumbs.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground/50 flex-none" />}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-none w-full md:w-auto">
                        {/* County Filter Dropdown */}
                        <div className="relative group">
                            <select
                                className="h-10 pl-9 pr-8 appearance-none bg-background border border-border/60 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all w-full md:w-48 cursor-pointer"
                                onChange={(e) => handleNavigate(e.target.value)}
                                value={currentPath.split('/')[0] || ""}
                            >
                                <option value="">Select County...</option>
                                {counties?.map(c => (
                                    <option key={c.path} value={c.name}>{c.name}</option>
                                ))}
                            </select>
                            <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                            <ChevronRight className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-muted-foreground pointer-events-none" />
                        </div>

                        {/* Search Input */}
                        <div className="relative flex-1 md:flex-none">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search here..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="h-10 pl-9 pr-4 w-full md:w-64 bg-background border border-border/60 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                            />
                        </div>
                    </div>
                </div>

                {currentPath && (
                    <Button variant="outline" size="sm" onClick={handleUp} className="self-start gap-2">
                        <ArrowLeft className="w-4 h-4" /> Back
                    </Button>
                )}
            </div>

            <div className="flex-1 glass rounded-2xl border-white/20 p-6 overflow-auto">
                {isLoading ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground animate-pulse">Loading...</div>
                ) : error ? (
                    <div className="flex items-center justify-center h-full text-destructive">Error loading directory</div>
                ) : filteredEntries?.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">{searchQuery ? 'No matching files found' : 'Empty folder'}</div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {filteredEntries?.map((entry) => (
                            <div
                                key={entry.path}
                                onClick={() => entry.isDirectory && handleNavigate(entry.path)}
                                className={cn(
                                    "group flex flex-col items-center justify-center p-6 rounded-2xl border transition-all relative overflow-hidden",
                                    entry.isDirectory
                                        ? "bg-blue-50/50 border-blue-100 hover:bg-blue-100/50 hover:border-blue-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-blue-500/10 cursor-pointer"
                                        : "bg-white/40 border-white/20 hover:bg-white/60 hover:border-primary/20 hover:scale-[1.02] hover:shadow-lg"
                                )}
                            >
                                <div className={cn(
                                    "mb-3 p-4 rounded-full transition-transform group-hover:scale-110 duration-300",
                                    entry.isDirectory ? "bg-blue-100/50 text-blue-600" : "bg-emerald-100/50 text-emerald-600"
                                )}>
                                    {entry.isDirectory ? <Folder className="w-8 h-8 fill-current opacity-80" /> : <FileText className="w-8 h-8 fill-current opacity-80" />}
                                </div>

                                <span className="text-sm font-semibold text-center line-clamp-2 break-words w-full px-2 text-foreground/80 group-hover:text-foreground">
                                    {entry.name}
                                </span>

                                {entry.isDirectory && (
                                    <div className="absolute inset-x-0 bottom-2 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            className="h-8 px-2 rounded-lg shadow-sm bg-white/80 hover:bg-white text-xs gap-1 border border-indigo-100"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                fetchDetailsMutation.mutate(entry.name);
                                            }}
                                            disabled={isExtracting}
                                        >
                                            {isExtracting && fetchDetailsMutation.variables === entry.name ? (
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                            ) : (
                                                <Sparkles className="w-3 h-3 text-indigo-500" />
                                            )}
                                            Fetch Details
                                        </Button>
                                    </div>
                                )}

                                {!entry.isDirectory && (
                                    <div className="absolute inset-0 flex items-center justify-center gap-3 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px]">
                                        <Button
                                            variant="secondary"
                                            size="icon"
                                            className="h-10 w-10 rounded-full shadow-lg bg-white hover:bg-white hover:scale-110 transition-transform"
                                            onClick={(e) => { e.stopPropagation(); handleDownload(entry.path, true); }}
                                            title="View"
                                        >
                                            <Eye className="w-5 h-5 text-primary" />
                                        </Button>
                                        <Button
                                            variant="default"
                                            size="icon"
                                            className="h-10 w-10 rounded-full shadow-lg hover:scale-110 transition-transform"
                                            onClick={(e) => { e.stopPropagation(); handleDownload(entry.path, false); }}
                                            title="Download"
                                        >
                                            <Download className="w-5 h-5" />
                                        </Button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Results Modal */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-6xl max-h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Extraction Results</DialogTitle>
                        <DialogDescription>
                            Review the data extracted from the PDF documents.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-auto border rounded-xl">
                        <Table>
                            <TableHeader className="bg-muted/50 sticky top-0">
                                <TableRow>
                                    <TableHead className="whitespace-nowrap">File Name</TableHead>
                                    <TableHead className="whitespace-nowrap">Document Type</TableHead>
                                    <TableHead className="whitespace-nowrap">Grantor</TableHead>
                                    <TableHead className="whitespace-nowrap">Grantee</TableHead>
                                    <TableHead className="whitespace-nowrap">Inst. Number</TableHead>
                                    <TableHead className="whitespace-nowrap">Recording Date</TableHead>
                                    <TableHead className="whitespace-nowrap">Book/Page</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {extractionData?.map((item: any) => (
                                    <TableRow key={item.id || item.sourceFile}>
                                        <TableCell className="font-medium">{item.sourceFile}</TableCell>
                                        <TableCell>{item.documentType}</TableCell>
                                        <TableCell>
                                            <div className="max-w-[200px] truncate" title={item.grantor}>
                                                {item.grantor}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="max-w-[200px] truncate" title={item.grantee}>
                                                {item.grantee}
                                            </div>
                                        </TableCell>
                                        <TableCell>{item.instrumentNumber}</TableCell>
                                        <TableCell>{item.recordingDate}</TableCell>
                                        <TableCell>{item.book ? `${item.book}/${item.pageNo}` : "-"}</TableCell>
                                    </TableRow>
                                ))}
                                {!extractionData || extractionData.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                                            No data extracted.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </DialogContent>
            </Dialog>

        </div>
    );
}
