"use client";

import { useRef, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, ImagePlus, Star, X } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DressThumb } from "@/components/admin/dress-thumb";
import { createClient } from "@/lib/supabase/client";
import { PRODUCT_IMAGES_BUCKET, productImageUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { addProductImage, deleteImage, moveImage, setCoverImage } from "./actions";

type Image = { id: string; storage_path: string; is_cover: boolean };

/** Thu nhỏ còn cạnh dài 1600px và chuyển sang WebP trước khi upload */
async function toWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob"))), "image/webp", 0.85),
  );
}

export function ImageManager({
  productId,
  images,
  preview,
}: {
  productId: string;
  images: Image[];
  preview: { name: string; color: string | null; category?: string | null };
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [pending, startTransition] = useTransition();

  async function upload(files: FileList) {
    const supabase = createClient();
    setUploading(files.length);
    for (const file of Array.from(files)) {
      try {
        const blob = await toWebp(file);
        const path = `${productId}/${crypto.randomUUID()}.webp`;
        const { error } = await supabase.storage
          .from(PRODUCT_IMAGES_BUCKET)
          .upload(path, blob, { contentType: "image/webp" });
        if (error) throw error;
        const result = await addProductImage(productId, path);
        if (!result.ok) throw new Error(result.error);
      } catch (error) {
        console.error(error);
        toast.error(`Không tải lên được ${file.name}. Chọn ảnh JPG, PNG hoặc WebP.`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) toast.error(result.error);
    });

  return (
    <div className="flex flex-col gap-3">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {images.length === 0 && (
          <li className="flex flex-col gap-2">
            <DressThumb {...preview} className="w-full rounded-lg" />
            <p className="text-xs text-muted-foreground">
              Đang hiện bản phác theo màu vải. Thêm ảnh thật để khách xem trên web.
            </p>
          </li>
        )}
        {images.map((img, index) => (
          <li key={img.id} className="group relative overflow-hidden rounded-lg border bg-muted">
            {/* Ảnh nhỏ trong trang quản trị, không cần tối ưu qua next/image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={productImageUrl(img.storage_path)}
              alt=""
              loading="lazy"
              className="aspect-[3/4] w-full object-cover"
            />
            {img.is_cover && (
              <span className="absolute top-2 left-2 rounded-full bg-card px-2 py-0.5 text-xs font-medium">Ảnh bìa</span>
            )}
            <div className="absolute inset-x-0 bottom-0 flex justify-between bg-card/90 p-1">
              <div className="flex">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Lên trước"
                  disabled={pending || index === 0}
                  onClick={() => act(() => moveImage(img.id, -1))}
                >
                  <ChevronLeft />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Ra sau"
                  disabled={pending || index === images.length - 1}
                  onClick={() => act(() => moveImage(img.id, 1))}
                >
                  <ChevronRight />
                </Button>
              </div>
              <div className="flex">
                {!img.is_cover && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Đặt làm ảnh bìa"
                    disabled={pending}
                    onClick={() => act(() => setCoverImage(img.id))}
                  >
                    <Star />
                  </Button>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Xoá ảnh" disabled={pending}>
                      <X />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Xoá ảnh này?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Ảnh bị xoá khỏi kho lưu trữ và không khôi phục được.
                        {img.is_cover && " Ảnh tiếp theo sẽ thành ảnh bìa."}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Giữ lại</AlertDialogCancel>
                      <AlertDialogAction variant="destructive" onClick={() => act(() => deleteImage(img.id))}>
                        Xoá ảnh
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading > 0}
            className={cn(
              "flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-sm text-muted-foreground hover:bg-muted",
              uploading > 0 && "animate-pulse",
            )}
          >
            <ImagePlus className="size-6" />
            {uploading > 0 ? `Đang tải ${uploading} ảnh…` : "Thêm ảnh"}
          </button>
        </li>
      </ul>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => e.target.files?.length && upload(e.target.files)}
      />
    </div>
  );
}
