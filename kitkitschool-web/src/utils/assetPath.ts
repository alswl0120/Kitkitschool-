const ASSET_BASE = import.meta.env.VITE_ASSET_BASE || ''

export function assetUrl(path: string): string {
  return `${ASSET_BASE}${path}`
}
