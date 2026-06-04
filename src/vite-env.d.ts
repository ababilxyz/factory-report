/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_QR_SECRET_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}