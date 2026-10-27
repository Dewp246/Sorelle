/**
 * Zone-based shipping estimate for Sorelle.
 *
 * This is a static, offline estimate used while Biteship's paid rates API is not
 * available. Keep the values in sync with the `create_order` database function in
 * supabase/migrations/20261027000000_zone_shipping.sql — the database is the
 * authority and recalculates every order; this table only drives the preview.
 */

export interface CourierOption {
  id: string;
  label: string;
  service: string;
  estimate: string;
  multiplier: number;
  zone1Only?: boolean;
}

export const COURIERS: CourierOption[] = [
  { id: 'anteraja_reg', label: 'AnterAja', service: 'Reguler', estimate: '3–5 hari', multiplier: 0.95 },
  { id: 'sicepat_reg', label: 'SiCepat', service: 'Reguler', estimate: '2–4 hari', multiplier: 1 },
  { id: 'jnt_express', label: 'J&T Express', service: 'Reguler', estimate: '2–4 hari', multiplier: 1.05 },
  { id: 'jne_reg', label: 'JNE', service: 'Reguler', estimate: '2–4 hari', multiplier: 1.1 },
  { id: 'grab_sameday', label: 'Grab', service: 'Same Day', estimate: 'Hari ini', multiplier: 1.6, zone1Only: true },
];

export const DEFAULT_COURIER_ID = 'sicepat_reg';
export const FREE_SHIPPING_THRESHOLD_IDR = 500_000;

export const ZONE_BASE_IDR: Record<number, number> = { 1: 18_000, 2: 32_000, 3: 45_000 };

const ZONE_1 = [
  'dki jakarta', 'jakarta', 'jawa barat', 'jawa tengah', 'jawa timur', 'banten',
  'di yogyakarta', 'diy', 'yogyakarta', 'bali',
];

const ZONE_3 = [
  'maluku', 'maluku utara', 'papua', 'papua barat', 'papua selatan', 'papua tengah',
  'papua pegunungan', 'papua barat daya', 'nusa tenggara timur', 'ntt',
];

export function zoneFromProvince(province: string): number {
  const value = (province || '').trim().toLowerCase();
  if (!value) return 2;
  if (ZONE_3.some((name) => value.includes(name))) return 3;
  if (ZONE_1.some((name) => value.includes(name))) return 1;
  return 2;
}

export function getCourier(id: string): CourierOption {
  return COURIERS.find((courier) => courier.id === id) ?? COURIERS[1];
}

export function availableCouriers(province: string): CourierOption[] {
  const zone = zoneFromProvince(province);
  return COURIERS.filter((courier) => !courier.zone1Only || zone === 1);
}

export function shippingCostIdr(subtotalIdr: number, province: string, courierId: string): number {
  if (subtotalIdr >= FREE_SHIPPING_THRESHOLD_IDR) return 0;
  const zone = zoneFromProvince(province);
  const courier = getCourier(courierId);
  const base = ZONE_BASE_IDR[zone] ?? ZONE_BASE_IDR[2];
  return Math.round((base * courier.multiplier) / 500) * 500;
}

export function zoneLabel(zone: number): string {
  if (zone === 1) return 'Jawa & Bali';
  if (zone === 3) return 'Maluku & Papua';
  return 'Sumatera, Kalimantan, Sulawesi & NTB';
}
