import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, Link } from "wouter";
import {
    Loader2, ShieldAlert, Users, LayoutDashboard, Database,
    ArrowLeft, Edit2, Trash2, Check, X, ChevronRight,
    CreditCard, Zap, Plus, DollarSign
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";

type Panel = "dashboard" | "users";

export default function AdminPage() {
    const { user } = useAuth();
    const [, setLocation] = useLocation();
    const [activePanel, setActivePanel] = useState<Panel>("dashboard");
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editUsername, setEditUsername] = useState("");
    const [editIsAdmin, setEditIsAdmin] = useState<number>(0);
    const [editPlan, setEditPlan] = useState<string>("payg");
    const [addCreditId, setAddCreditId] = useState<number | null>(null);
    const [addCreditAmount, setAddCreditAmount] = useState<string>("1000");

    // Redirect if not admin
    if (user && user.isAdmin !== 1) {
        setLocation("/");
        return null;
    }

    const queryClient = useQueryClient();

    const updateMutation = useMutation({
        mutationFn: async (data: { id: number; username: string; isAdmin: number; plan: string }) => {
            const res = await apiRequest("PATCH", `/api/admin/users/${data.id}`, data);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
            setEditingId(null);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            await apiRequest("DELETE", `/api/admin/users/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
        },
        onError: (error: Error) => {
            alert(`Failed to delete: ${error.message}`);
        }
    });

    const addCreditsMutation = useMutation({
        mutationFn: async ({ id, amount }: { id: number; amount: number }) => {
            const res = await apiRequest("POST", `/api/admin/users/${id}/add-credits`, { amount });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
            setAddCreditId(null);
        },
        onError: (error: Error) => {
            alert(`Failed to add credits: ${error.message}`);
        }
    });

    const { data: usersStats, isLoading, error } = useQuery<any[]>({
        queryKey: ["/api/admin/users"],
        enabled: !!user && user.isAdmin === 1,
    });

    const totalUsers = usersStats?.length || 0;
    const totalUploads = usersStats?.reduce((acc, c) => acc + c.totalUploads, 0) || 0;
    const totalScrapes = usersStats?.reduce((acc, c) => acc + c.totalScrapes, 0) || 0;
    const totalRevenue = usersStats?.reduce((acc, c) => acc + c.estimatedBill, 0) || 0;

    const navItems: { id: Panel; label: string; icon: React.ReactNode }[] = [
        { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="w-5 h-5" /> },
        { id: "users", label: "Users", icon: <Users className="w-5 h-5" /> },
    ];

    return (
        <div className="flex min-h-screen bg-background text-foreground animate-in fade-in duration-300">

            {/* ── Left Sidebar ── */}
            <aside className="w-64 shrink-0 border-r border-border/20 flex flex-col glass">
                <div className="px-6 py-5 border-b border-border/10">
                    <div className="flex items-center gap-2 mb-1">
                        <ShieldAlert className="w-5 h-5 text-primary" />
                        <span className="font-bold text-sm uppercase tracking-widest text-foreground">Admin Portal</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Logged in as <span className="font-semibold text-foreground">{user?.username}</span></p>
                </div>

                <nav className="flex-1 px-3 py-4 space-y-1">
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActivePanel(item.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group ${activePanel === item.id
                                ? "bg-primary/15 text-primary"
                                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                                }`}
                        >
                            {item.icon}
                            <span className="flex-1 text-left">{item.label}</span>
                            <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${activePanel === item.id ? "rotate-90 text-primary" : "opacity-0 group-hover:opacity-50"}`} />
                        </button>
                    ))}
                </nav>

                <div className="p-4 border-t border-border/10">
                    <Link href="/">
                        <a className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-lg hover:bg-white/5">
                            <ArrowLeft className="w-4 h-4" />
                            Back to Dashboard
                        </a>
                    </Link>
                </div>
            </aside>

            {/* ── Main Content ── */}
            <main className="flex-1 overflow-y-auto p-8">

                {isLoading && (
                    <div className="flex items-center justify-center min-h-[50vh]">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                )}

                {error && !isLoading && (
                    <div className="flex flex-col items-center justify-center min-h-[50vh] text-destructive">
                        <ShieldAlert className="h-12 w-12 mb-4" />
                        <h2 className="text-xl font-bold">Error loading admin data</h2>
                        <p className="opacity-80">You might not have permission, or the server is unreachable.</p>
                    </div>
                )}

                {/* ── Dashboard Panel ── */}
                {!isLoading && !error && activePanel === "dashboard" && (
                    <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight text-foreground mb-1">Dashboard</h1>
                            <p className="text-muted-foreground">Overview of system activity and billing.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                            {/* Total Users */}
                            <button
                                onClick={() => setActivePanel("users")}
                                className="glass text-left p-5 rounded-2xl border border-border/20 relative overflow-hidden group hover:border-primary/30 transition-all duration-300 cursor-pointer"
                            >
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 group-hover:opacity-20 transition-all duration-500">
                                    <Users className="w-16 h-16" />
                                </div>
                                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Total Users</p>
                                <h3 className="text-3xl font-black text-foreground">{totalUsers}</h3>
                                <p className="text-xs text-primary mt-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">Manage <ChevronRight className="w-3 h-3" /></p>
                            </button>

                            {/* Total Uploads */}
                            <div className="glass p-5 rounded-2xl border border-border/20 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500 text-primary">
                                    <LayoutDashboard className="w-16 h-16" />
                                </div>
                                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Total Uploads</p>
                                <h3 className="text-3xl font-black text-foreground">{totalUploads}</h3>
                            </div>

                            {/* Total Scrapes */}
                            <div className="glass p-5 rounded-2xl border border-border/20 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500 text-blue-500">
                                    <Database className="w-16 h-16" />
                                </div>
                                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Total Scrapes Run</p>
                                <h3 className="text-3xl font-black text-foreground">{totalScrapes.toLocaleString()}</h3>
                            </div>

                            {/* Estimated Revenue */}
                            <div className="glass p-5 rounded-2xl border border-border/20 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500 text-green-500">
                                    <DollarSign className="w-16 h-16" />
                                </div>
                                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Est. PAYG Revenue</p>
                                <h3 className="text-3xl font-black text-green-500">${totalRevenue.toLocaleString()}</h3>
                            </div>
                        </div>

                        {/* Quick jump */}
                        <div className="glass rounded-2xl border border-border/20 p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-bold text-foreground">Manage Users & Billing</h2>
                                    <p className="text-sm text-muted-foreground mt-0.5">Set plans, top up credits, and monitor scrape activity per user.</p>
                                </div>
                                <button
                                    onClick={() => setActivePanel("users")}
                                    className="flex items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
                                >
                                    <Users className="w-4 h-4" />
                                    Open Users
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Plan overview cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            <div className="glass rounded-2xl border border-border/20 p-5">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="bg-orange-500/15 text-orange-500 p-2 rounded-xl"><Zap className="w-5 h-5" /></div>
                                    <div>
                                        <h3 className="font-bold text-foreground">Pay-As-You-Go</h3>
                                        <p className="text-xs text-muted-foreground">$1.00 per scrape</p>
                                    </div>
                                </div>
                                <p className="text-sm text-muted-foreground">Users are billed per scrape run. No upfront cost. Admin tracks total scrapes for invoicing.</p>
                            </div>
                            <div className="glass rounded-2xl border border-border/20 p-5">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="bg-primary/15 text-primary p-2 rounded-xl"><CreditCard className="w-5 h-5" /></div>
                                    <div>
                                        <h3 className="font-bold text-foreground">Credits Package</h3>
                                        <p className="text-xs text-muted-foreground">1000 credits = $1,000</p>
                                    </div>
                                </div>
                                <p className="text-sm text-muted-foreground">Users pre-purchase credits. 1 credit deducted per scrape. Scrape is blocked when credits reach 0.</p>
                            </div>
                            <div className="glass rounded-2xl border border-border/20 p-5">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="bg-purple-500/15 text-purple-500 p-2 rounded-xl"><Database className="w-5 h-5" /></div>
                                    <div>
                                        <h3 className="font-bold text-foreground">Per Row Credits</h3>
                                        <p className="text-xs text-muted-foreground">1 credit per uploaded row</p>
                                    </div>
                                </div>
                                <p className="text-sm text-muted-foreground">Credits deducted upfront based on rows in uploaded Excel. Subsequent scrapes for those rows are free.</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Users Panel ── */}
                {!isLoading && !error && activePanel === "users" && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-3xl font-bold tracking-tight text-foreground mb-1">Users</h1>
                                <p className="text-muted-foreground">Manage user accounts, plans, and credit balances.</p>
                            </div>
                            <span className="glass border border-border/20 px-4 py-1.5 rounded-full text-sm font-semibold text-muted-foreground">
                                {totalUsers} {totalUsers === 1 ? "user" : "users"}
                            </span>
                        </div>

                        <div className="glass rounded-2xl border border-border/20 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-border/10 bg-muted/10">
                                            <th className="px-5 py-4 font-bold uppercase tracking-wider text-xs text-muted-foreground">User</th>
                                            <th className="px-5 py-4 font-bold uppercase tracking-wider text-xs text-muted-foreground">Role</th>
                                            <th className="px-5 py-4 font-bold uppercase tracking-wider text-xs text-muted-foreground">Plan</th>
                                            <th className="px-5 py-4 font-bold uppercase tracking-wider text-xs text-muted-foreground text-right">Credits / Scrapes</th>
                                            <th className="px-5 py-4 font-bold uppercase tracking-wider text-xs text-muted-foreground text-right">Uploads</th>
                                            <th className="px-5 py-4 font-bold uppercase tracking-wider text-xs text-muted-foreground text-right">Billing</th>
                                            <th className="px-5 py-4 font-bold uppercase tracking-wider text-xs text-muted-foreground text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/10">
                                        {usersStats?.map((stat) => (
                                            <tr key={stat.id} className="hover:bg-muted/20 transition-colors group">
                                                {/* Username */}
                                                <td className="px-5 py-4">
                                                    {editingId === stat.id ? (
                                                        <input
                                                            type="text"
                                                            value={editUsername}
                                                            onChange={(e) => setEditUsername(e.target.value)}
                                                            className="bg-background border border-border rounded-lg px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary w-full max-w-[140px]"
                                                            autoFocus
                                                        />
                                                    ) : (
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm uppercase shrink-0">
                                                                {stat.username.charAt(0)}
                                                            </div>
                                                            <span className="font-semibold text-foreground">{stat.username}</span>
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Role */}
                                                <td className="px-5 py-4">
                                                    {editingId === stat.id ? (
                                                        <select
                                                            value={editIsAdmin}
                                                            onChange={(e) => setEditIsAdmin(Number(e.target.value))}
                                                            className="bg-background border border-border rounded-lg px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                                        >
                                                            <option value={0}>User</option>
                                                            <option value={1}>Admin</option>
                                                        </select>
                                                    ) : stat.isAdmin === 1 ? (
                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-primary/15 text-primary border border-primary/25">Admin</span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-muted text-muted-foreground border border-border/40">User</span>
                                                    )}
                                                </td>

                                                {/* Plan */}
                                                <td className="px-5 py-4">
                                                    {editingId === stat.id ? (
                                                        <select
                                                            value={editPlan}
                                                            onChange={(e) => setEditPlan(e.target.value)}
                                                            className="bg-background border border-border rounded-lg px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                                        >
                                                            <option value="payg">Pay-As-You-Go</option>
                                                            <option value="credits">Credits</option>
                                                            <option value="per_row_credits">Per Row Credits</option>
                                                        </select>
                                                    ) : stat.plan === "credits" ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                                                            <CreditCard className="w-3 h-3" /> Credits
                                                        </span>
                                                    ) : stat.plan === "per_row_credits" ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-500/10 text-purple-500 border border-purple-500/20">
                                                            <Database className="w-3 h-3" /> Per Row
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-500/10 text-orange-500 border border-orange-500/20">
                                                            <Zap className="w-3 h-3" /> PAYG
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Credits / Scrapes */}
                                                <td className="px-5 py-4 text-right">
                                                    {stat.plan === "credits" || stat.plan === "per_row_credits" ? (
                                                        <div>
                                                            <span className={`font-bold font-mono text-sm ${stat.credits <= 10 ? "text-destructive" : "text-primary"}`}>
                                                                {stat.credits.toLocaleString()}
                                                            </span>
                                                            <span className="text-xs text-muted-foreground ml-1">credits</span>
                                                        </div>
                                                    ) : (
                                                        <div>
                                                            <span className="font-bold font-mono text-sm text-foreground">{stat.totalScrapes.toLocaleString()}</span>
                                                            <span className="text-xs text-muted-foreground ml-1">scrapes</span>
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Uploads */}
                                                <td className="px-5 py-4 text-right font-medium text-foreground">{stat.totalUploads}</td>

                                                {/* Billing */}
                                                <td className="px-5 py-4 text-right">
                                                    {stat.plan === "credits" ? (
                                                        <span className="text-sm text-muted-foreground">
                                                            ${((stat.totalScrapes / 1000) * 1000).toFixed(0)} used
                                                        </span>
                                                    ) : stat.plan === "per_row_credits" ? (
                                                        <span className="text-sm text-muted-foreground">
                                                            Pre-paid
                                                        </span>
                                                    ) : (
                                                        <span className="text-sm font-bold text-green-500">${stat.estimatedBill.toFixed(2)}</span>
                                                    )}
                                                </td>

                                                {/* Actions */}
                                                <td className="px-5 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        {/* Add Credits inline input */}
                                                        {addCreditId === stat.id && (
                                                            <div className="flex items-center gap-1.5 mr-1">
                                                                <input
                                                                    type="number"
                                                                    value={addCreditAmount}
                                                                    onChange={(e) => setAddCreditAmount(e.target.value)}
                                                                    className="bg-background border border-border rounded-lg px-2 py-1 text-sm text-foreground w-20 focus:outline-none focus:ring-2 focus:ring-primary"
                                                                    placeholder="Amount"
                                                                    min="1"
                                                                />
                                                                <button
                                                                    onClick={() => addCreditsMutation.mutate({ id: stat.id, amount: parseInt(addCreditAmount) })}
                                                                    disabled={addCreditsMutation.isPending}
                                                                    className="p-1.5 text-green-500 hover:bg-green-500/10 rounded-lg transition-colors"
                                                                    title="Confirm"
                                                                >
                                                                    {addCreditsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                                                </button>
                                                                <button
                                                                    onClick={() => setAddCreditId(null)}
                                                                    className="p-1.5 text-muted-foreground hover:bg-muted rounded-lg transition-colors"
                                                                >
                                                                    <X className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        )}

                                                        {editingId === stat.id ? (
                                                            <>
                                                                <button
                                                                    onClick={() => updateMutation.mutate({ id: stat.id, username: editUsername, isAdmin: editIsAdmin, plan: editPlan })}
                                                                    disabled={updateMutation.isPending}
                                                                    className="p-1.5 text-green-500 hover:bg-green-500/10 rounded-lg transition-colors"
                                                                    title="Save"
                                                                >
                                                                    {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                                                </button>
                                                                <button
                                                                    onClick={() => setEditingId(null)}
                                                                    className="p-1.5 text-muted-foreground hover:bg-muted rounded-lg transition-colors"
                                                                    title="Cancel"
                                                                >
                                                                    <X className="w-4 h-4" />
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                {/* Add Credits button (only show for credits plan users) */}
                                                                {(stat.plan === "credits" || stat.plan === "per_row_credits") && addCreditId !== stat.id && (
                                                                    <button
                                                                        onClick={() => { setAddCreditId(stat.id); setAddCreditAmount("1000"); }}
                                                                        className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                                        title="Add Credits"
                                                                    >
                                                                        <Plus className="w-4 h-4" />
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={() => {
                                                                        setEditingId(stat.id);
                                                                        setEditUsername(stat.username);
                                                                        setEditIsAdmin(stat.isAdmin);
                                                                        setEditPlan(stat.plan || "payg");
                                                                    }}
                                                                    className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                                    title="Edit User"
                                                                >
                                                                    <Edit2 className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        if (window.confirm("Are you sure you want to delete this user? All associated uploads will be detached.")) {
                                                                            deleteMutation.mutate(stat.id);
                                                                        }
                                                                    }}
                                                                    disabled={user?.id === stat.id || deleteMutation.isPending}
                                                                    className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed opacity-0 group-hover:opacity-100"
                                                                    title={user?.id === stat.id ? "Cannot delete yourself" : "Delete User"}
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {(!usersStats || usersStats.length === 0) && (
                                            <tr>
                                                <td colSpan={7} className="px-5 py-12 text-center text-muted-foreground">
                                                    <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                                    No users found
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
