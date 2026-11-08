export type JewelleryKind = 'EARRINGS' | 'NECKLACE';

export interface Overlay {
  url: string;
  scale: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
}

/** The current renderer accepts calibrated transparent images. Future renderers can add a separate format. */
export interface OverlayAsset extends Overlay {
  format: 'image2d';
  kind: JewelleryKind;
}

export interface TryOnConfig {
  eligible: boolean;
  photoEnabled: boolean;
  arEnabled: boolean;
  providerConfigured: boolean;
  maxUploadMb: number;
  retentionHours: number;
  consentVersion: string;
  kind: JewelleryKind | null;
  overlay: Overlay | null;
}

export interface TryOnJob {
  id: string;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  expiresAt: string;
  errorCode: string | null;
  canRetry: boolean;
  resultUrl: string | null;
}

export interface EligibleProduct {
  id: string;
  name: string;
  sku: string;
  slug: string;
}

