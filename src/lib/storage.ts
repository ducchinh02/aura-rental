export const PRODUCT_IMAGES_BUCKET = "product-images";

export function productImageUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/${path}`;
}
