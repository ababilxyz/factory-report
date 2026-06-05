/**
 * Compress an image file on the client side before upload.
 * Resizes to max 1024px width and quality 80% JPEG.
 */
export async function compressImage(file: File, maxWidth = 1024, quality = 0.8): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const reader = new FileReader()

    reader.onload = (e) => {
      img.src = e.target?.result as string
    }

    img.onload = () => {
      const canvas = document.createElement('canvas')
      let { width, height } = img

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width)
        width = maxWidth
      }

      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas not supported')); return }

      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error('Image compression failed')); return }
          const compressed = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
            type: 'image/jpeg',
            lastModified: Date.now()
          })
          resolve(compressed)
        },
        'image/jpeg',
        quality
      )
    }

    img.onerror = () => reject(new Error('Failed to load image'))
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

/**
 * Create and return a persistent hidden file input element
 */
let persistentInput: HTMLInputElement | null = null;

function getPersistentInput(): HTMLInputElement {
  if (!persistentInput) {
    persistentInput = document.createElement('input');
    persistentInput.type = 'file';
    persistentInput.accept = 'image/*';
    persistentInput.capture = 'environment';
    persistentInput.style.display = 'none';
    document.body.appendChild(persistentInput);
  }
  return persistentInput;
}

/**
 * Capture a photo via the camera on mobile devices.
 * Uses a persistent hidden input to prevent page reloads.
 */
export function openCameraCapture(): Promise<File> {
  return new Promise((resolve, reject) => {
    const input = getPersistentInput();
    
    const handleChange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        resolve(file);
      } else {
        reject(new Error('No file selected'));
      }
    };

    const handleCancel = () => {
      reject(new Error('Camera cancelled'));
    };

    // Remove any existing listeners to prevent duplicates
    input.removeEventListener('change', handleChange);
    input.removeEventListener('cancel', handleCancel);
    
    input.addEventListener('change', handleChange);
    input.addEventListener('cancel', handleCancel);

    input.click();
  });
}

/**
 * Convert a file to a data URL for serialization/storage
 */
export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Convert a data URL back to a File
 */
export async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], filename, { type: blob.type, lastModified: Date.now() });
}
