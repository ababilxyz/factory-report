import { supabase } from './supabase'

const BUCKET_NAME = 'factory-reports'

/**
 * Upload an image file to Supabase Storage.
 * 
 * Supabase Realtime doesn't support progress callbacks, so this returns immediately
 * after the upload completes. For progress, consider using a separate progress indicator.
 * 
 * Setup required in Supabase Dashboard:
 * 1. Go to Storage > Buckets
 * 2. Create bucket named "factory-reports"
 * 3. Set bucket to Public (for image URLs to be accessible)
 * 4. Add bucket policies for authenticated users
 */
export async function uploadImage(
  file: File,
  onProgress?: (percent: number) => void
): Promise<{ url: string }> {
  // Signal start of upload
  if (onProgress) onProgress(0)

  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${file.name.split('.').pop()}`

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false
    })

  if (error) throw error

  // Signal completion
  if (onProgress) onProgress(100)

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(data.path)

  return {
    url: urlData.publicUrl
  }
}