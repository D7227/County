import { Link, useLocation } from "wouter";
import { LayoutDashboard, Upload, Layers, Activity, LogOut, Download, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Upload Data", href: "/upload", icon: Upload },
  { name: "Scrape Records", href: "/scrape", icon: Layers },
  { name: "Downloads", href: "/downloads", icon: Download },
  { name: "County Settings", href: "/counties", icon: Users },
];

export function Sidebar() {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();

  const initials = user?.username?.substring(0, 2).toUpperCase() || "??";

  return (
    <div className="hidden md:flex flex-col w-64 glass border-r border-white/20 min-h-screen fixed left-0 top-0 z-20 shadow-[-10px_0_30px_rgba(0,0,0,0.1)_inset]">
      <div className="p-8 pb-10">
        <div className="flex items-center gap-4 group cursor-default">
          <div className="p-2.5 bg-primary rounded-2xl text-primary-foreground shadow-lg shadow-primary/30 group-hover:scale-110 transition-transform duration-300">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display tracking-tight text-foreground leading-tight">ScrapeFlow</h1>
            <p className="text-[10px] uppercase tracking-widest text-primary font-bold">Intelligence CRM</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-6 space-y-1.5">
        {navigation.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.name} href={item.href} className={cn(
              "flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 group relative overflow-hidden",
              isActive
                ? "bg-primary text-primary-foreground shadow-xl shadow-primary/25 font-bold"
                : "text-muted-foreground hover:bg-white/50 hover:text-foreground font-semibold"
            )}>
              {isActive && (
                <div className="absolute left-0 top-0 w-1 h-full bg-white/20" />
              )}
              <item.icon className={cn("w-5 h-5", isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-primary group-hover:scale-110 transition-all")} />
              <span className="tracking-tight">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-6 mt-auto">
        <div className="glass-darker rounded-2xl p-5 border-white/10 group hover:bg-white/30 transition-all duration-300">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-blue-500/20 group-hover:rotate-6 transition-transform">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{user?.username}</p>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">User Account</p>
            </div>
          </div>
          <button
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
            className="w-full mt-4 flex items-center justify-center gap-2 text-xs font-bold text-muted-foreground hover:text-destructive py-2.5 rounded-xl bg-white/40 hover:bg-white/60 transition-all border border-white/10"
          >
            <LogOut className="w-4 h-4" />
            {logoutMutation.isPending ? "Logging out..." : "Sign Out"}
          </button>
        </div>
      </div>
    </div>
  );
}
