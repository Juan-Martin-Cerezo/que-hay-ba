export type SourceId = "eventbrite" | "alternativa" | "gcba";

export interface RawEvent {
  source: SourceId;
  sourceId: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  url: string;
  ticketsUrl?: string | null;
  startsAt: Date;
  endsAt?: Date | null;
  venueName: string;
  address?: string | null;
  barrio?: string | null;
  lat?: number | null;
  lng?: number | null;
  isFree?: boolean | null;
  priceMin?: number | null;
  priceMax?: number | null;
  priceText?: string | null;
  sourceCategories?: string[];
}
