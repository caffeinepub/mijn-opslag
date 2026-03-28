import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Cloud,
  Download,
  File,
  FileText,
  FileVideo,
  FolderOpen,
  Image as ImageIcon,
  Loader2,
  LogOut,
  MoreVertical,
  Trash2,
  Upload,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useInternetIdentity } from "./hooks/useInternetIdentity";
import {
  type StoredFile,
  useDeleteFile,
  useGetCallerUserProfile,
  useGetFiles,
  useSaveCallerUserProfile,
  useUploadFile,
} from "./hooks/useQueries";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function formatBytes(bytes: number | bigint): string {
  const n = typeof bytes === "bigint" ? Number(bytes) : bytes;
  if (n === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(n) / Math.log(k));
  return `${Number.parseFloat((n / k ** i).toFixed(1))} ${sizes[i]}`;
}

function isImageFile(name: string) {
  return /\.(jpg|jpeg|png|gif|webp|svg|bmp|heic|heif)$/i.test(name);
}

function isVideoFile(name: string) {
  return /\.(mp4|mov|avi|mkv|webm)$/i.test(name);
}

function isPdfFile(name: string) {
  return /\.pdf$/i.test(name);
}

function getFileCategory(
  name: string,
): "image" | "video" | "document" | "other" {
  if (isImageFile(name)) return "image";
  if (isVideoFile(name)) return "video";
  if (isPdfFile(name) || /\.(doc|docx|txt|xls|xlsx|ppt|pptx)$/i.test(name))
    return "document";
  return "other";
}

function FileIcon({
  name,
  className = "",
}: { name: string; className?: string }) {
  const cat = getFileCategory(name);
  if (cat === "image") return <ImageIcon className={className} />;
  if (cat === "video") return <FileVideo className={className} />;
  if (cat === "document") return <FileText className={className} />;
  return <File className={className} />;
}

// ─────────────────────────────────────────────
// Login screen
// ─────────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm bg-card rounded-2xl shadow-card p-8 flex flex-col items-center gap-6"
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Cloud className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold text-foreground">Mijn Opslag</span>
        </div>
        <h1 className="text-2xl font-bold text-center text-foreground">
          Welkom terug
        </h1>
        <p className="text-sm text-muted-foreground text-center">
          Log in om toegang te krijgen tot je bestanden en foto&apos;s.
        </p>
        <Button
          data-ocid="login.primary_button"
          className="w-full text-base py-5 rounded-xl"
          onClick={onLogin}
        >
          <Cloud className="mr-2 w-4 h-4" />
          Inloggen
        </Button>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Profile setup dialog
// ─────────────────────────────────────────────
function ProfileSetupDialog({
  open,
  onSave,
  isSaving,
}: {
  open: boolean;
  onSave: (name: string) => void;
  isSaving: boolean;
}) {
  const [name, setName] = useState("");

  return (
    <Dialog open={open}>
      <DialogContent
        data-ocid="profile_setup.dialog"
        className="sm:max-w-sm"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Profiel instellen</DialogTitle>
          <DialogDescription>Hoe mogen we je noemen?</DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <Label htmlFor="profile-name" className="mb-1.5 block">
            Jouw naam
          </Label>
          <Input
            id="profile-name"
            data-ocid="profile_setup.input"
            placeholder="Jan de Vries"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" && name.trim() && onSave(name.trim())
            }
          />
        </div>
        <DialogFooter>
          <Button
            data-ocid="profile_setup.submit_button"
            onClick={() => onSave(name.trim())}
            disabled={!name.trim() || isSaving}
            className="w-full"
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Opslaan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────
// Upload area
// ─────────────────────────────────────────────
const ACCEPTED_TYPES =
  "image/*,video/*,application/pdf,.doc,.docx,.txt,.xls,.xlsx";
const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200 MB

function UploadArea({
  uploading,
  progress,
  onFiles,
}: {
  uploading: boolean;
  progress: number;
  onFiles: (files: FileList) => void;
}) {
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
    },
    [onFiles],
  );

  return (
    <label
      data-ocid="upload.dropzone"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`relative border-2 border-dashed rounded-2xl transition-colors p-8 flex flex-col items-center gap-3 cursor-pointer ${
        dragging
          ? "border-primary bg-accent"
          : "border-border hover:border-primary/50 hover:bg-accent/50"
      }`}
    >
      <input
        type="file"
        multiple
        accept={ACCEPTED_TYPES}
        disabled={uploading}
        className="sr-only"
        onClick={(e) => {
          (e.currentTarget as HTMLInputElement).value = "";
        }}
        onChange={(e) => e.target.files && onFiles(e.target.files)}
      />
      {uploading ? (
        <>
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm font-medium text-foreground">Uploaden...</p>
          <div className="w-full max-w-xs">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground text-center mt-1">
              {progress}%
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center">
            <Upload className="w-6 h-6 text-primary" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-foreground">
              Bestanden uploaden
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Sleep hier naartoe of tik om te bladeren
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Foto&apos;s, video&apos;s en documenten (max 200 MB)
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-medium px-4 py-1.5 rounded-full pointer-events-none">
            Bestand kiezen
          </span>
        </>
      )}
    </label>
  );
}

// ─────────────────────────────────────────────
// File card
// ─────────────────────────────────────────────
function FileCard({
  file,
  index,
  onDelete,
}: {
  file: StoredFile;
  index: number;
  onDelete: (id: string, name: string) => void;
}) {
  const isImg = isImageFile(file.name);
  const url = isImg ? file.content.getDirectURL() : null;

  return (
    <motion.div
      data-ocid={`files.item.${index + 1}`}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ duration: 0.2, delay: index * 0.03 }}
      className="group bg-card rounded-xl overflow-hidden shadow-card border border-border hover:shadow-md transition-shadow"
    >
      {/* Thumbnail / icon */}
      <div className="relative aspect-square bg-muted flex items-center justify-center overflow-hidden">
        {isImg && url ? (
          <img
            src={url}
            alt={file.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <FileIcon
            name={file.name}
            className="w-10 h-10 text-muted-foreground"
          />
        )}

        {/* Actions overlay */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                className="h-7 w-7 rounded-full shadow-sm"
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                onClick={() => {
                  const link = document.createElement("a");
                  link.href = file.content.getDirectURL();
                  link.download = file.name;
                  link.click();
                }}
              >
                <Download className="mr-2 h-4 w-4" /> Downloaden
              </DropdownMenuItem>
              <DropdownMenuItem
                data-ocid={`files.delete_button.${index + 1}`}
                className="text-destructive focus:text-destructive"
                onClick={() => onDelete(file.id, file.name)}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Verwijderen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Meta */}
      <div className="p-3">
        <p
          className="text-xs font-medium text-foreground truncate"
          title={file.name}
        >
          {file.name}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {formatBytes(file.size)}
        </p>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────
// Storage summary
// ─────────────────────────────────────────────
function StorageSummary({ files }: { files: StoredFile[] }) {
  const totalBytes = files.reduce((acc, f) => acc + Number(f.size), 0);
  const images = files.filter((f) => isImageFile(f.name)).length;
  const docs = files.filter((f) => !isImageFile(f.name)).length;
  const quotaBytes = 1 * 1024 * 1024 * 1024;
  const usedPct = Math.min(100, (totalBytes / quotaBytes) * 100);

  return (
    <div className="bg-card rounded-2xl border border-border shadow-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-foreground">Opslagruimte</h2>
        <span className="text-xs text-muted-foreground">
          {formatBytes(totalBytes)} / 1 GB
        </span>
      </div>
      <Progress value={usedPct} className="h-2 mb-4" />
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: "Bestanden",
            value: files.length,
            icon: <FolderOpen className="w-4 h-4" />,
          },
          {
            label: "Foto's",
            value: images,
            icon: <ImageIcon className="w-4 h-4" />,
          },
          {
            label: "Documenten",
            value: docs,
            icon: <FileText className="w-4 h-4" />,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col items-center gap-1 bg-background rounded-xl p-3 text-center"
          >
            <span className="text-primary">{stat.icon}</span>
            <span className="text-lg font-bold text-foreground">
              {stat.value}
            </span>
            <span className="text-[10px] text-muted-foreground leading-none">
              {stat.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Delete confirm dialog
// ─────────────────────────────────────────────
function DeleteDialog({
  open,
  fileName,
  isDeleting,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  fileName: string;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent data-ocid="delete.dialog" className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Bestand verwijderen</DialogTitle>
          <DialogDescription>
            Weet je zeker dat je <strong>{fileName}</strong> wilt verwijderen?
            Dit kan niet ongedaan worden gemaakt.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            data-ocid="delete.cancel_button"
            variant="outline"
            onClick={onCancel}
            disabled={isDeleting}
          >
            Annuleren
          </Button>
          <Button
            data-ocid="delete.confirm_button"
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Verwijderen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────
// Main App
// ─────────────────────────────────────────────
const SKELETON_KEYS = [
  "sk-1",
  "sk-2",
  "sk-3",
  "sk-4",
  "sk-5",
  "sk-6",
  "sk-7",
  "sk-8",
];

export default function App() {
  const { login, clear, identity } = useInternetIdentity();
  const queryClient = useQueryClient();
  const isAuthenticated = !!identity;

  const {
    data: profile,
    isLoading: profileLoading,
    isFetched: profileFetched,
  } = useGetCallerUserProfile();
  const saveProfile = useSaveCallerUserProfile();

  const { data: files = [], isLoading: filesLoading } = useGetFiles();
  const uploadFile = useUploadFile();
  const deleteFile = useDeleteFile();

  const [activeTab, setActiveTab] = useState("alles");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const showProfileSetup =
    isAuthenticated && !profileLoading && profileFetched && profile === null;

  const handleLogin = async () => {
    try {
      await login();
    } catch (e: any) {
      if (e?.message === "User is already authenticated") {
        await clear();
        setTimeout(() => login(), 300);
      }
    }
  };

  const handleLogout = async () => {
    await clear();
    queryClient.clear();
    toast.success("Uitgelogd");
  };

  const handleFiles = async (fileList: FileList) => {
    const filesArr = Array.from(fileList);
    for (const file of filesArr) {
      // Check file size before uploading
      if (file.size > MAX_FILE_SIZE) {
        toast.error(
          `${file.name} is te groot (max 200 MB). Trim de video kort of kies een kleiner bestand.`,
        );
        continue;
      }

      setUploadProgress(0);
      try {
        await uploadFile.mutateAsync({
          file,
          onProgress: setUploadProgress,
        });
        toast.success(`${file.name} geüpload`);
      } catch (err: unknown) {
        console.error("Upload error:", err);
        const msg = err instanceof Error ? err.message : String(err);
        toast.error(`Upload mislukt voor ${file.name}: ${msg}`);
      }
    }
    setUploadProgress(0);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await deleteFile.mutateAsync(deleteTarget.id);
      toast.success(`${deleteTarget.name} verwijderd`);
    } catch {
      toast.error("Verwijderen mislukt");
    } finally {
      setDeleteTarget(null);
    }
  };

  const filteredFiles = files.filter((f) => {
    if (activeTab === "fotos") return isImageFile(f.name);
    if (activeTab === "documenten") return !isImageFile(f.name);
    return true;
  });

  const initials = profile?.name
    ? profile.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .substring(0, 2)
        .toUpperCase()
    : "?";

  if (!isAuthenticated) {
    return (
      <>
        <LoginScreen onLogin={handleLogin} />
        <Toaster />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Toaster />

      {/* Profile setup */}
      <ProfileSetupDialog
        open={showProfileSetup}
        onSave={(name) => saveProfile.mutate({ name })}
        isSaving={saveProfile.isPending}
      />

      {/* Delete confirm */}
      <DeleteDialog
        open={!!deleteTarget}
        fileName={deleteTarget?.name ?? ""}
        isDeleting={deleteFile.isPending}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Header */}
      <header className="sticky top-0 z-30 bg-card border-b border-border shadow-xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-4">
          {/* Brand */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Cloud className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-foreground text-base hidden sm:block">
              Mijn Opslag
            </span>
          </div>

          {/* Nav (desktop) */}
          <nav className="hidden md:flex items-center gap-1 ml-2">
            {["Mijn Bestanden", "Foto's", "Recent"].map((label) => (
              <button
                key={label}
                type="button"
                data-ocid="nav.link"
                className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="flex-1" />

          {/* Upload CTA */}
          <Button
            data-ocid="header.upload_button"
            size="sm"
            className="rounded-full gap-1.5 hidden sm:flex"
            disabled={uploadFile.isPending}
            asChild
          >
            <label className="cursor-pointer">
              <input
                type="file"
                multiple
                accept={ACCEPTED_TYPES}
                className="sr-only"
                onClick={(e) => {
                  (e.currentTarget as HTMLInputElement).value = "";
                }}
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
              />
              <Upload className="w-3.5 h-3.5" />
              Uploaden
            </label>
          </Button>

          {/* Bell */}
          <button
            type="button"
            className="w-8 h-8 rounded-full hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            data-ocid="nav.link"
          >
            <Bell className="w-4 h-4" />
          </button>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" data-ocid="user.button">
                <Avatar className="h-8 w-8 cursor-pointer">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-48"
              data-ocid="user.dropdown_menu"
            >
              <div className="px-3 py-2 border-b border-border mb-1">
                <p className="text-sm font-medium truncate">
                  {profile?.name ?? "Gebruiker"}
                </p>
              </div>
              <DropdownMenuItem
                data-ocid="user.logout.button"
                onClick={handleLogout}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" /> Uitloggen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6">
        {/* Upload area */}
        <UploadArea
          uploading={uploadFile.isPending}
          progress={uploadProgress}
          onFiles={handleFiles}
        />

        {/* Storage summary */}
        <StorageSummary files={files} />

        {/* Tabs + files */}
        <div className="space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-card border border-border">
              <TabsTrigger data-ocid="files.tab" value="alles">
                Alles
              </TabsTrigger>
              <TabsTrigger data-ocid="files.tab" value="fotos">
                Foto&apos;s
              </TabsTrigger>
              <TabsTrigger data-ocid="files.tab" value="documenten">
                Documenten
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* File grid */}
          {filesLoading ? (
            <div
              data-ocid="files.loading_state"
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
            >
              {SKELETON_KEYS.map((k) => (
                <div key={k} className="space-y-2">
                  <Skeleton className="aspect-square rounded-xl" />
                  <Skeleton className="h-3 w-3/4 rounded" />
                  <Skeleton className="h-2 w-1/2 rounded" />
                </div>
              ))}
            </div>
          ) : filteredFiles.length === 0 ? (
            <motion.div
              data-ocid="files.empty_state"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-16 gap-4"
            >
              <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center">
                <FolderOpen className="w-8 h-8 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold text-foreground">
                  Geen bestanden gevonden
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {activeTab === "fotos"
                    ? "Upload je eerste foto om te beginnen."
                    : activeTab === "documenten"
                      ? "Nog geen documenten geüpload."
                      : "Upload bestanden om te beginnen met opslaan."}
                </p>
              </div>
            </motion.div>
          ) : (
            <AnimatePresence mode="popLayout">
              <div
                data-ocid="files.list"
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
              >
                {filteredFiles.map((file, i) => (
                  <FileCard
                    key={file.id}
                    file={file}
                    index={i}
                    onDelete={(id, name) => setDeleteTarget({ id, name })}
                  />
                ))}
              </div>
            </AnimatePresence>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card mt-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Mijn Opslag
          </p>
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Gebouwd met ❤️ via caffeine.ai
          </a>
        </div>
      </footer>

      {/* Mobile FAB upload */}
      <div className="fixed bottom-6 right-6 sm:hidden">
        <Button
          data-ocid="mobile.upload_button"
          size="icon"
          className="h-14 w-14 rounded-full shadow-lg"
          disabled={uploadFile.isPending}
          asChild
        >
          <label className="cursor-pointer flex items-center justify-center">
            <input
              type="file"
              multiple
              accept={ACCEPTED_TYPES}
              className="sr-only"
              onClick={(e) => {
                (e.currentTarget as HTMLInputElement).value = "";
              }}
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
            {uploadFile.isPending ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <Upload className="h-6 w-6" />
            )}
          </label>
        </Button>
      </div>
    </div>
  );
}
