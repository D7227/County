import { Link } from "wouter";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md bg-card rounded-2xl shadow-xl p-8 border border-border text-center">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h1 className="text-4xl font-bold text-foreground mb-2">404</h1>
        <p className="text-xl font-medium text-muted-foreground mb-6">Page not found</p>
        <p className="text-sm text-muted-foreground mb-8">
          The page you are looking for doesn't exist or has been moved.
        </p>

        <Link href="/" className="inline-flex items-center justify-center w-full px-6 py-3 rounded-xl font-semibold bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-200">
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
