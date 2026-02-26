import { useScrapeItems, useUploads } from "@/hooks/use-scraping";
import { StatsCard } from "@/components/StatsCard";
import { StatusBadge } from "@/components/StatusBadge";
import { FileSpreadsheet, ListChecks, CheckCircle2, AlertTriangle, ArrowUpRight, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";

export default function Dashboard() {
  const { data: uploads } = useUploads();
  const { data: items } = useScrapeItems();

  const totalTasks = items?.length || 0;
  const completedTasks = items?.filter(i => i.status === 'completed').length || 0;
  const pendingTasks = items?.filter(i => i.status === 'pending').length || 0;
  const failedTasks = items?.filter(i => i.status === 'failed').length || 0;

  // Calculate generic "completion rate" for trend
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard Overview</h2>
          <p className="text-muted-foreground mt-1">Real-time scraping metrics and activity.</p>
        </div>
        <div className="flex gap-3">
          <Link href="/upload" className="inline-flex items-center justify-center rounded-xl bg-white border border-input px-4 py-2 text-sm font-medium shadow-sm hover:bg-secondary/80 transition-colors">
            Upload New File
          </Link>
          <Link href="/tasks" className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors">
            View All Tasks
          </Link>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Tasks"
          value={totalTasks}
          icon={<ListChecks className="w-6 h-6" />}
          trend="+12%"
          trendUp={true}
        />
        <StatsCard
          title="Completed"
          value={completedTasks}
          icon={<CheckCircle2 className="w-6 h-6" />}
          trend={`${completionRate}% Rate`}
          trendUp={true}
        />
        <StatsCard
          title="Pending Queue"
          value={pendingTasks}
          icon={<FileSpreadsheet className="w-6 h-6" />}
          trend="-2%"
          trendUp={true}
        />
        <StatsCard
          title="Failed Tasks"
          value={failedTasks}
          icon={<AlertTriangle className="w-6 h-6" />}
          trend="Needs Attention"
          trendUp={false}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Uploads Card */}
        <div className="glass rounded-2xl overflow-hidden border-white/20">
          <div className="p-6 border-b border-white/10 flex justify-between items-center">
            <h3 className="font-semibold text-lg">Recent Uploads</h3>
            <Link href="/upload" className="text-sm text-primary hover:text-primary/80 font-medium flex items-center gap-1">
              View All <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="p-0">
            {uploads?.slice(0, 5).map((upload, i) => (
              <div key={upload.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors border-b border-border/40 last:border-0">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-green-50 text-green-600 flex items-center justify-center">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{upload.filename}</p>
                    <p className="text-xs text-muted-foreground">{upload.createdAt ? format(new Date(upload.createdAt), 'MMM dd, yyyy HH:mm') : 'N/A'}</p>
                  </div>
                </div>
                <div className="text-xs font-medium text-muted-foreground bg-secondary px-2.5 py-1 rounded-md">
                  ID: #{upload.id}
                </div>
              </div>
            ))}
            {(!uploads || uploads.length === 0) && (
              <div className="p-8 text-center text-muted-foreground">
                <p>No files uploaded yet.</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity Card */}
        <div className="glass rounded-2xl overflow-hidden border-white/20">
          <div className="p-6 border-b border-white/10 flex justify-between items-center">
            <h3 className="font-semibold text-lg">Recent Task Activity</h3>
            <Link href="/tasks" className="text-sm text-primary hover:text-primary/80 font-medium flex items-center gap-1">
              Manage Tasks <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="p-0">
            {items?.slice(0, 5).map((item) => (
              <div key={item.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors border-b border-border/40 last:border-0">
                <div className="flex items-center gap-3">
                  {/* Attempt to find a 'name' or 'title' or 'url' in the JSONB data */}
                  {(() => {
                    const data = item.data as Record<string, any>;
                    const title = data.name || data.Name || data.title || data.Title || data.url || data.URL || `Task #${item.id}`;
                    return (
                      <div className="truncate max-w-[200px]">
                        <p className="font-medium text-sm truncate" title={String(title)}>{String(title)}</p>
                        <p className="text-xs text-muted-foreground">Upload #{item.uploadId}</p>
                      </div>
                    );
                  })()}
                </div>
                <StatusBadge status={item.status} />
              </div>
            ))}
            {(!items || items.length === 0) && (
              <div className="p-8 text-center text-muted-foreground">
                <p>No tasks processed yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
