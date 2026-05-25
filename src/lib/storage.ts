// URL pública de un archivo en un bucket público de Supabase Storage.
export function urlPublica(bucket: string, path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}
