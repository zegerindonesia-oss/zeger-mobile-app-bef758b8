import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Upload, Loader2, X, ImagePlus } from "lucide-react";

interface ImageUploadProps {
  value?: string | null;
  onChange: (url: string) => void;
  bucket: "product-images" | "banner-images" | "loyalty-images";
  folder?: string;
  label?: string;
  aspect?: "square" | "banner";
  disabled?: boolean;
}

// 10-year signed URL (buckets are private in this workspace)
const SIGNED_URL_EXPIRY_SECONDS = 60 * 60 * 24 * 365 * 10;

export function ImageUpload({
  value,
  onChange,
  bucket,
  folder = "",
  label = "Foto",
  aspect = "square",
  disabled,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handlePick = () => inputRef.current?.click();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("File harus berupa gambar");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ukuran gambar maksimal 5MB");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const fileName = `${folder ? folder + "/" : ""}${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, { upsert: false, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: signed, error: signError } = await supabase.storage
        .from(bucket)
        .createSignedUrl(fileName, SIGNED_URL_EXPIRY_SECONDS);

      if (signError || !signed?.signedUrl) throw signError || new Error("Gagal buat URL");

      onChange(signed.signedUrl);
      toast.success("Foto berhasil diupload");
    } catch (err: any) {
      toast.error("Gagal upload: " + (err.message || "unknown"));
    } finally {
      setUploading(false);
    }
  };

  const boxClass =
    aspect === "banner"
      ? "w-full h-40 rounded-lg"
      : "w-32 h-32 rounded-lg";

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />

      {value ? (
        <div className="relative inline-block group">
          <img
            src={value}
            alt={label}
            className={`${boxClass} object-cover border border-border`}
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={handlePick}
              disabled={disabled || uploading}
            >
              <Upload className="h-3.5 w-3.5 mr-1" /> Ganti
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => onChange("")}
              disabled={disabled || uploading}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={handlePick}
          disabled={disabled || uploading}
          className={`${boxClass} border-2 border-dashed border-border bg-muted/30 hover:bg-muted/50 flex flex-col items-center justify-center gap-1 text-muted-foreground transition-colors`}
        >
          {uploading ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-xs">Mengupload...</span>
            </>
          ) : (
            <>
              <ImagePlus className="h-6 w-6" />
              <span className="text-xs">Upload {label}</span>
              <span className="text-[10px]">Maks 5MB</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}