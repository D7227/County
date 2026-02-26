import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar } from "@/components/Sidebar";
import Dashboard from "@/pages/Dashboard";
import UploadPage from "@/pages/UploadPage";
import TasksPage from "@/pages/TasksPage";
import UnifiedScrapePage from "@/pages/UnifiedScrapePage";
import DownloadsPage from "@/pages/DownloadsPage";
import CountyPage from "@/pages/CountyPage";
import AuthPage from "@/pages/AuthPage";
import NotFound from "@/pages/not-found";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { BatchScrapeProvider } from "@/hooks/use-batch-scrape";
import { Loader2 } from "lucide-react";

function ProtectedRoute({ component: Component, path }: { component: React.ComponentType<any>, path: string }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <div className="flex min-h-screen text-foreground relative z-10 w-full">
      <Sidebar />
      <main className="flex-1 md:ml-64 p-4 md:p-6 overflow-x-hidden">
        <div className="max-w-[1700px] mx-auto">
          <Route path={path} component={Component} />
        </div>
      </main>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={Dashboard} />
      <ProtectedRoute path="/upload" component={UploadPage} />
      <ProtectedRoute path="/upload" component={UploadPage} />
      <ProtectedRoute path="/tasks" component={TasksPage} />
      <ProtectedRoute path="/scrape" component={UnifiedScrapePage} />
      <ProtectedRoute path="/downloads" component={DownloadsPage} />
      <ProtectedRoute path="/counties" component={CountyPage} />
      <Route path="/auth" component={AuthPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BatchScrapeProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </BatchScrapeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
