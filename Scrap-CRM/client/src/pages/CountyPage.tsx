import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { CountySetting, InsertCountySetting } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Globe, ShieldAlert, Settings2, CheckCircle2, XCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCountySettingSchema } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";

export default function CountyPage() {
    const { toast } = useToast();
    const [editingId, setEditingId] = useState<number | null>(null);
    const { data: settings, isLoading } = useQuery<CountySetting[]>({
        queryKey: ["/api/county-settings"],
    });

    const createMutation = useMutation({
        mutationFn: async (data: InsertCountySetting) => {
            const res = await apiRequest("POST", "/api/county-settings", data);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/county-settings"] });
            toast({ title: "Success", description: "County setting created." });
            form.reset();
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            await apiRequest("DELETE", `/api/county-settings/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/county-settings"] });
            toast({ title: "Deleted", description: "County setting removed." });
        },
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: number; data: Partial<InsertCountySetting> }) => {
            const res = await apiRequest("PATCH", `/api/county-settings/${id}`, data);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/county-settings"] });
            toast({ title: "Updated", description: "County setting updated successfully." });
            setEditingId(null);
            form.reset();
        },
    });

    const handleEdit = (setting: CountySetting) => {
        setEditingId(setting.id);
        form.reset({
            name: setting.name,
            searchUrl: setting.searchUrl,
            scrapeLot: setting.scrapeLot,
            scrapeParty: setting.scrapeParty,
            vpnRequired: setting.vpnRequired,
        });
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        form.reset({
            name: "",
            searchUrl: "",
            scrapeLot: 1,
            scrapeParty: 1,
            vpnRequired: 0,
        });
    };

    const form = useForm<InsertCountySetting>({
        resolver: zodResolver(insertCountySettingSchema),
        defaultValues: {
            name: "",
            searchUrl: "",
            scrapeParty: 1,
            scrapeLot: 1,
            vpnRequired: 0,
        },
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
                        <Settings2 className="w-6 h-6" />
                    </div>
                    <h1 className="text-3xl font-bold font-display tracking-tight text-foreground">County Settings</h1>
                </div>
                <p className="text-muted-foreground text-sm max-w-2xl">
                    Manage your dynamic county configurations. Define search URLs, scraping modes, and VPN requirements for each county.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="lg:col-span-1 border-white/20 glass-darker overflow-hidden shadow-xl">
                    <CardHeader className="border-b border-white/10 bg-white/5">
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                            <Plus className="w-4 h-4 text-primary" /> Add New County
                        </CardTitle>
                        <CardDescription className="text-xs">Configure a new county for automated searching.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit((data) => {
                                if (editingId) {
                                    updateMutation.mutate({ id: editingId, data });
                                } else {
                                    createMutation.mutate(data);
                                }
                            })} className="space-y-5">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">County Name</FormLabel>
                                            <FormControl>
                                                <Input placeholder="e.g. BERGEN" {...field} className="glass border-white/10 focus:ring-primary/20" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="searchUrl"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Search URL</FormLabel>
                                            <FormControl>
                                                <Input placeholder="https://..." {...field} className="glass border-white/10 focus:ring-primary/20" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="space-y-4 pt-2">
                                    <FormField
                                        control={form.control}
                                        name="scrapeLot"
                                        render={({ field }) => (
                                            <FormItem className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4 shadow-sm">
                                                <div className="space-y-0.5">
                                                    <FormLabel className="text-xs font-bold">Scrape Lot/Block</FormLabel>
                                                    <FormDescription className="text-[10px]">Enable Phase 1 Lot/Block search.</FormDescription>
                                                </div>
                                                <FormControl>
                                                    <Switch
                                                        checked={field.value === 1}
                                                        onCheckedChange={(checked) => field.onChange(checked ? 1 : 0)}
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="scrapeParty"
                                        render={({ field }) => (
                                            <FormItem className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4 shadow-sm">
                                                <div className="space-y-0.5">
                                                    <FormLabel className="text-xs font-bold">Scrape Party Names</FormLabel>
                                                    <FormDescription className="text-[10px]">Enable Phase 2 Variation search.</FormDescription>
                                                </div>
                                                <FormControl>
                                                    <Switch
                                                        checked={field.value === 1}
                                                        onCheckedChange={(checked) => field.onChange(checked ? 1 : 0)}
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="vpnRequired"
                                        render={({ field }) => (
                                            <FormItem className="flex items-center justify-between rounded-xl border border-destructive/20 bg-destructive/5 p-4 shadow-sm">
                                                <div className="space-y-0.5">
                                                    <FormLabel className="text-xs font-bold text-destructive flex items-center gap-2">
                                                        VPN Required
                                                    </FormLabel>
                                                    <FormDescription className="text-[10px]">Check this if search requires a VPN.</FormDescription>
                                                </div>
                                                <FormControl>
                                                    <Switch
                                                        checked={field.value === 1}
                                                        onCheckedChange={(checked) => field.onChange(checked ? 1 : 0)}
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <div className="flex gap-3 pt-2">
                                    {editingId && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="flex-1 h-12 rounded-xl text-sm font-bold border-white/10 hover:bg-white/5"
                                            onClick={handleCancelEdit}
                                        >
                                            Cancel
                                        </Button>
                                    )}
                                    <Button
                                        type="submit"
                                        className="flex-1 h-12 rounded-xl text-sm font-bold shadow-lg shadow-primary/20"
                                        disabled={createMutation.isPending || updateMutation.isPending}
                                    >
                                        {createMutation.isPending || updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : (editingId ? <CheckCircle2 className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />)}
                                        {editingId ? "Update County" : "Save County"}
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    </CardContent>
                </Card>

                <Card className="lg:col-span-2 border-white/20 glass-darker shadow-xl overflow-hidden">
                    <CardHeader className="border-b border-white/10 bg-white/5">
                        <CardTitle className="text-lg font-bold">Active County Configurations</CardTitle>
                        <CardDescription className="text-xs">Your system will automatically use these settings based on the record's county.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader className="bg-white/5">
                                <TableRow className="hover:bg-transparent border-white/10">
                                    <TableHead className="text-xs font-bold uppercase py-4 pl-6">County</TableHead>
                                    <TableHead className="text-xs font-bold uppercase py-4">Configuration</TableHead>
                                    <TableHead className="text-xs font-bold uppercase py-4">VPN</TableHead>
                                    <TableHead className="text-xs font-bold uppercase py-4 text-right pr-6">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {settings?.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                                            No counties configured yet. Create one to get started.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    settings?.map((setting) => (
                                        <TableRow key={setting.id} className="hover:bg-white/5 border-white/5 group transition-colors">
                                            <TableCell className="py-4 pl-6">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-sm">{setting.name}</span>
                                                    <span className="text-[10px] text-muted-foreground truncate max-w-[200px] flex items-center gap-1">
                                                        <Globe className="w-2 h-2" /> {setting.searchUrl}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex gap-2">
                                                    {setting.scrapeLot === 1 ? (
                                                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-500/10 text-blue-500 rounded-full text-[10px] font-bold border border-blue-500/20">
                                                            <CheckCircle2 className="w-2.5 h-2.5" /> Lot/Block
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-500/10 text-slate-500 rounded-full text-[10px] font-bold border border-slate-500/20 grayscale">
                                                            <XCircle className="w-2.5 h-2.5" /> Lot/Block
                                                        </div>
                                                    )}
                                                    {setting.scrapeParty === 1 ? (
                                                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-primary/10 text-primary rounded-full text-[10px] font-bold border border-primary/20">
                                                            <CheckCircle2 className="w-2.5 h-2.5" /> Party Name
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-500/10 text-slate-500 rounded-full text-[10px] font-bold border border-slate-500/20 grayscale">
                                                            <XCircle className="w-2.5 h-2.5" /> Party Name
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {setting.vpnRequired === 1 ? (
                                                    <div className="flex items-center gap-1.5 text-destructive font-bold text-[10px]">
                                                        <ShieldAlert className="w-3 h-3" /> Required
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground text-[10px]">Not Required</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right pr-6">
                                                <div className="flex justify-end gap-2 transition-opacity">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg"
                                                        onClick={() => handleEdit(setting)}
                                                    >
                                                        <Settings2 className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                                                        onClick={() => deleteMutation.mutate(setting.id)}
                                                        disabled={deleteMutation.isPending}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
