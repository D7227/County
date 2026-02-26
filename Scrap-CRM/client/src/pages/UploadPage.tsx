import { useState } from "react";
import { useCreateUpload, useUploads, useDeleteUpload } from "@/hooks/use-scraping";
import { Upload, FileSpreadsheet, Check, AlertCircle, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
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

export default function UploadPage() {
  const [isDragging, setIsDragging] = useState(false);
  const { mutate: createUpload, isPending } = useCreateUpload();
  const { data: uploads, isLoading: isLoadingUploads } = useUploads();
  const { mutate: deleteUpload } = useDeleteUpload();
  const { toast } = useToast();
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; filename: string } | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    // Validate file type
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
      "application/vnd.ms-excel", // xls
      "text/csv" // csv
    ];

    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/)) {
      toast({
        variant: "destructive",
        title: "Invalid file type",
        description: "Please upload an Excel (.xlsx, .xls) or CSV file.",
      });
      return;
    }
    createUpload(file, {
      onSuccess: () => {
        toast({
          title: "File uploaded successfully",
          description: "Your data has been processed and tasks created.",
        });
      },
      onError: (error) => {
        toast({
          variant: "destructive",
          title: "Upload failed",
          description: error.message,
        });
      }
    });
  };

  const handleDeleteUpload = (id: number, filename: string) => {
    setDeleteConfirm({ id, filename });
  };

  const confirmDelete = () => {
    if (!deleteConfirm) return;
    deleteUpload(deleteConfirm.id, {
      onSuccess: () => {
        toast({
          title: "File deleted",
          description: "The file and its tasks have been removed.",
        });
      }
    });
    setDeleteConfirm(null);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Upload Data</h2>
        <p className="text-muted-foreground mt-1">Import Excel or CSV files to generate scraping tasks.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Upload Area */}
        <div className="lg:col-span-2">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              "relative border-2 border-dashed rounded-3xl p-12 text-center transition-all duration-300 ease-out flex flex-col items-center justify-center min-h-[400px] glass",
              isDragging
                ? "border-primary bg-primary/5 scale-[1.01] shadow-xl"
                : "border-white/20 hover:border-primary/50 hover:bg-white/40",
              isPending && "opacity-50 pointer-events-none"
            )}
          >
            {isPending ? (
              <div className="flex flex-col items-center animate-in zoom-in duration-300">
                <Loader2 className="w-16 h-16 text-primary animate-spin mb-6" />
                <h3 className="text-xl font-semibold">Processing File...</h3>
                <p className="text-muted-foreground mt-2">Parsing rows and creating tasks. This may take a moment.</p>
              </div>
            ) : (
              <>
                <div className="w-20 h-20 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-6 shadow-inner">
                  <Upload className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-bold mb-2">Drag & Drop your file here</h3>
                <p className="text-muted-foreground mb-8 max-w-sm">
                  Support for .xlsx, .xls, and .csv files. Rows will be automatically converted to tasks.
                </p>

                <div className="relative">
                  <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileInput}
                  />
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer inline-flex items-center justify-center px-8 py-3 rounded-xl font-semibold bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
                  >
                    Browse Files
                  </label>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Recent Files Sidebar */}
        <div className="glass rounded-3xl p-6 h-fit border-white/20">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            Upload History
          </h3>

          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
            {isLoadingUploads ? (
              <div className="flex justify-center py-8 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : uploads && uploads.length > 0 ? (
              uploads.map((file) => (
                <div key={file.id} className="group flex items-start gap-3 p-3 rounded-xl hover:bg-secondary/50 transition-colors border border-transparent hover:border-border/50">
                  <div className="mt-1 w-8 h-8 rounded-lg bg-green-100 text-green-600 flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate" title={file.filename}>{file.filename}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {file.createdAt ? format(new Date(file.createdAt), "MMM d, h:mm a") : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleDeleteUpload(file.id, file.filename)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title="Delete file"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <Check className="w-4 h-4 text-green-500" />
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground bg-secondary/30 rounded-xl border border-dashed border-border">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No files uploaded yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent className="bg-white/90 backdrop-blur-2xl border-white/50 rounded-[2.5rem] p-10 max-w-md animate-in zoom-in-95 duration-300 shadow-[0_32px_64px_-16px_rgba(221,83,53,0.15)] overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary via-blue-500 to-primary" />
          <AlertDialogHeader>
            <div className="w-20 h-20 bg-destructive/5 rounded-[2rem] flex items-center justify-center text-destructive mb-6 self-start transform -rotate-6 border border-destructive/10">
              <Trash2 className="w-10 h-10" />
            </div>
            <AlertDialogTitle className="text-3xl font-extrabold tracking-tight text-foreground">
              Delete File
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground/80 text-lg font-medium mt-3 leading-relaxed">
              Are you sure you want to delete <span className="text-primary font-bold italic">"{deleteConfirm?.filename}"</span> and all its rows? This action cannot be undone.
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
