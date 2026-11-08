export interface PublicImage { url: string; alt: string | null; width: number | null; height: number | null; id?: string; position?: number; isPrimary?: boolean }
export interface Category { id: string; name: string; slug: string; description: string; imageUrl: string | null; visible: boolean; sortOrder: number }
export interface Product {
  id: string; name: string; sku: string; slug: string; description: string;
  metal: 'GOLD' | 'SILVER' | 'PLATINUM' | 'MIXED'; purity: string;
  grossWeight: string; netWeight: string; stoneWeight: string | null;
  stoneDetails: string | null; diamondDetails: string | null; gemstoneDetails: string | null;
  hallmark: string | null; huid: string | null; enquiryOnly: boolean;
  publicPrice: string | null; publicMakingCharge: string | null;
  availability: 'AVAILABLE' | 'RESERVED' | 'SOLD'; featured: boolean; exclusive: boolean; newArrival: boolean;
  seoTitle: string | null; seoDescription: string | null;
  category: Pick<Category, 'id' | 'name' | 'slug'>; images: PublicImage[];
}
export interface Collection { id: string; name: string; slug: string; description: string; seoTitle: string | null; seoDescription: string | null; bridal: boolean; sortOrder: number; coverImage: PublicImage | null; bannerImage: PublicImage | null }
export interface Pagination { page: number; limit: number; total: number; pages: number }
export interface ListResponse<T> { data: T[]; pagination: Pagination }
export interface DataResponse<T> { data: T }
export interface CollectionDetail { data: Collection & { products: Product[] }; pagination: Pagination }
export interface HomeSection {
  id: string; type: 'HERO' | 'FEATURED_COLLECTIONS' | 'NEW_ARRIVALS' | 'FEATURED_PRODUCTS' | 'BRIDAL' | 'PROMOTIONAL' | 'CUSTOM_JEWELLERY' | 'APPOINTMENT' | 'EDITORIAL';
  heading: string; subtitle: string | null; description: string | null; ctaLabel: string | null; ctaPath: string | null; position: number;
  desktopImage: PublicImage | null; mobileImage: PublicImage | null; products: Product[]; collections: Collection[];
}
export interface Banner extends Pick<HomeSection, 'id' | 'heading' | 'subtitle' | 'ctaLabel' | 'ctaPath' | 'position' | 'desktopImage' | 'mobileImage'> { imageAlt: string }
export interface Homepage { version: number | null; publishedAt: string | null; sections: HomeSection[]; banners: Banner[] }
export interface ContactOptions { whatsappNumber: string | null; timezone: string | null }
export interface Receipt { reference: string; token?: string; status: string; receivedAt?: string; requestedAt?: string; proposedAt?: string | null; scheduledAt?: string | null; endsAt?: string | null; reason?: string | null }
export type SearchParams = Record<string, string | string[] | undefined>;
