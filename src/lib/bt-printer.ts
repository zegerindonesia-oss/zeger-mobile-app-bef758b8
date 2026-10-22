// Direct Bluetooth (BLE) printing: sends raw ESC/POS (receipt/kitchen) or TSPL (label) bytes
// straight to the printer, skipping the Android/Chrome print dialog.
// Works in Chrome/Edge on Android, Windows, ChromeOS (Web Bluetooth). Printer must expose BLE.

const SERVICES = [
  0x18f0, 0xff00, 0xffe0, 0xfee7, 0xae30, 0x49535343,
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '000018f0-0000-1000-8000-00805f9b34fb',
];

import { Capacitor } from '@capacitor/core';
import { BleClient } from '@capacitor-community/bluetooth-le';
import { registerPlugin } from '@capacitor/core';

/** Bluetooth Classic (SPP) bridge for printers paired in Android settings (most Xprinter/label printers). */
const BtSerial = registerPlugin<{
  listPaired(): Promise<{ devices: { address: string; name: string; type?: number }[] }>;
  connect(o: { address: string }): Promise<void>;
  write(o: { address: string; data: string }): Promise<void>;
  disconnect(o: { address: string }): Promise<void>;
}>('BtSerial');
const SPP = 'spp:';
const b64 = (u: Uint8Array) => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };

type Conn = { device: any; ch: any };
const conns = new Map<string, Conn>();
const nameKey = (id: string) => `zeger_bt_printer_${id}`;
const devKey = (id: string) => `zeger_bt_device_${id}`;

const isNative = () => Capacitor.isNativePlatform();
const webBt = () => typeof navigator !== 'undefined' && !!(navigator as any).bluetooth;

export const btSupported = () => isNative() || webBt();
export const btSavedName = (printerId: string) => localStorage.getItem(nameKey(printerId));
export const btIsConnected = (printerId: string) => !!conns.get(printerId)?.device?.gatt?.connected || nativeConn.has(printerId);

// ---------- Native (Android/iOS app) ----------
type NativeCh = { deviceId: string; service: string; characteristic: string; noResp: boolean };
const nativeConn = new Map<string, NativeCh>();
let bleReady = false;
const ensureBle = async () => {
  if (!bleReady) { await BleClient.initialize({ androidNeverForLocation: true }); bleReady = true; }
  if (!(await BleClient.isEnabled())) {
    try { await BleClient.requestEnable(); } catch { throw new Error('Nyalakan Bluetooth di tablet terlebih dulu.'); }
  }
};
const nativeOpen = async (printerId: string, deviceId: string, name?: string) => {
  await ensureBle();
  try { await BleClient.connect(deviceId, () => nativeConn.delete(printerId), { timeout: 10000 }); }
  catch (e: any) { if (!/already/i.test(String(e?.message))) throw new Error('Gagal tersambung ke printer. Pastikan printer menyala & dekat tablet.'); }
  const services = await BleClient.getServices(deviceId);
  for (const s of services) for (const c of s.characteristics) {
    if (c.properties.writeWithoutResponse || c.properties.write) {
      const ch = { deviceId, service: s.uuid, characteristic: c.uuid, noResp: !!c.properties.writeWithoutResponse };
      nativeConn.set(printerId, ch);
      localStorage.setItem(devKey(printerId), deviceId);
      if (name) localStorage.setItem(nameKey(printerId), name);
      return ch;
    }
  }
  throw new Error('Printer tidak punya jalur tulis Bluetooth (BLE).');
};
const fullUuid = (s: number | string) =>
  typeof s === 'number' ? `${s.toString(16).padStart(8, '0')}-0000-1000-8000-00805f9b34fb` : s.toLowerCase();
const ALL_SERVICES = Array.from(new Set(SERVICES.map(fullUuid)));
const nativePair = async (printerId: string) => {
  await ensureBle();
  const d = await BleClient.requestDevice({ optionalServices: ALL_SERVICES });
  await nativeOpen(printerId, d.deviceId, d.name || 'Printer Bluetooth');
  return d.name || 'Printer Bluetooth';
};

export type BtFound = { deviceId: string; name: string; rssi?: number; paired?: boolean };

/** Printers already paired in Android Bluetooth settings (Classic SPP). Empty if the APK lacks the bridge. */
export const btListPaired = async (): Promise<BtFound[]> => {
  if (!isNative()) return [];
  try {
    const { devices } = await BtSerial.listPaired();
    return devices.map((d) => ({ deviceId: SPP + d.address, name: d.name || d.address, paired: true }));
  } catch (e: any) {
    if (/not implemented|unimplemented/i.test(String(e?.message || e?.code))) return [];
    throw e;
  }
};
/** Native app only: scan all nearby Bluetooth devices for ~8s, reporting each one found. */
export const btScan = async (onFound: (d: BtFound) => void, ms = 8000) => {
  await ensureBle();
  const seen = new Set<string>();
  await BleClient.requestLEScan({ allowDuplicates: false }, (r) => {
    if (seen.has(r.device.deviceId)) return;
    seen.add(r.device.deviceId);
    onFound({ deviceId: r.device.deviceId, name: r.device.name || r.localName || 'Perangkat tanpa nama', rssi: r.rssi });
  });
  await new Promise((res) => setTimeout(res, ms));
  await BleClient.stopLEScan().catch(() => {});
};
export const btStopScan = () => BleClient.stopLEScan().catch(() => {});
export const btCanScan = () => isNative();
/** Connect a printer slot to a device picked from btScan. */
export const btConnectTo = async (printerId: string, d: BtFound) => {
  await BleClient.stopLEScan().catch(() => {});
  if (d.deviceId.startsWith(SPP)) {
    await BtSerial.connect({ address: d.deviceId.slice(SPP.length) });
    localStorage.setItem(devKey(printerId), d.deviceId);
    localStorage.setItem(nameKey(printerId), d.name);
    return d.name;
  }
  await nativeOpen(printerId, d.deviceId, d.name);
  return d.name;
};
const savedSpp = (printerId: string) => {
  const id = localStorage.getItem(devKey(printerId));
  return id?.startsWith(SPP) ? id.slice(SPP.length) : null;
};
const nativeReconnect = async (printerId: string) => {
  const c = nativeConn.get(printerId);
  if (c) return c;
  const id = localStorage.getItem(devKey(printerId));
  if (id?.startsWith(SPP)) return null;
  return id ? nativeOpen(printerId, id) : null;
};

const findWritable = async (server: any) => {
  for (const s of await server.getPrimaryServices()) {
    for (const c of await s.getCharacteristics()) {
      if (c.properties.writeWithoutResponse || c.properties.write) return c;
    }
  }
  throw new Error('Printer tidak punya jalur tulis Bluetooth (BLE).');
};

const open = async (printerId: string, device: any) => {
  const server = device.gatt.connected ? device.gatt : await device.gatt.connect();
  const ch = await findWritable(server);
  conns.set(printerId, { device, ch });
  localStorage.setItem(nameKey(printerId), device.name || 'Printer Bluetooth');
  return ch;
};

/** User gesture required. Shows the Bluetooth device picker. */
export const btPair = async (printerId: string) => {
  if (isNative()) return nativePair(printerId);
  if (!webBt()) throw new Error('Browser ini belum mendukung Bluetooth langsung. Gunakan Chrome di Android/PC.');
  const device = await (navigator as any).bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: ALL_SERVICES });
  await open(printerId, device);
  return device.name as string;
};

export const btForget = (printerId: string) => {
  try { conns.get(printerId)?.device?.gatt?.disconnect(); } catch { /* ignore */ }
  const n = nativeConn.get(printerId);
  if (n) BleClient.disconnect(n.deviceId).catch(() => {});
  const spp = savedSpp(printerId);
  if (spp && isNative()) BtSerial.disconnect({ address: spp }).catch(() => {});
  conns.delete(printerId); nativeConn.delete(printerId);
  localStorage.removeItem(nameKey(printerId)); localStorage.removeItem(devKey(printerId));
};

/** Reconnect silently to a previously paired device (Chrome getDevices permission). */
const reconnect = async (printerId: string) => {
  const c = conns.get(printerId);
  if (c) return c.device.gatt.connected ? c.ch : open(printerId, c.device);
  const saved = btSavedName(printerId);
  const bt = (navigator as any).bluetooth;
  if (!saved || !bt?.getDevices) return null;
  const devs = await bt.getDevices();
  const d = devs.find((x: any) => x.name === saved);
  return d ? open(printerId, d) : null;
};

export const btSend = async (printerId: string, data: Uint8Array) => {
  const chunk = 180;
  if (isNative()) {
    const spp = savedSpp(printerId);
    if (spp) { await BtSerial.write({ address: spp, data: b64(data) }); return; }
    let ch = await nativeReconnect(printerId);
    if (!ch) throw new Error('Printer Bluetooth belum terhubung. Buka Pengaturan Printer → Hubungkan.');
    // Cheap label printers often keep the default 23-byte MTU: size chunks to the real MTU.
    let size = 20;
    try { size = Math.max(20, Math.min(180, (await BleClient.getMtu(ch.deviceId)) - 3)); } catch { /* keep 20 */ }
    for (let i = 0; i < data.length; i += size) {
      const part = data.slice(i, i + size);
      const dv = new DataView(part.buffer, part.byteOffset, part.byteLength);
      try {
        if (ch.noResp) await BleClient.writeWithoutResponse(ch.deviceId, ch.service, ch.characteristic, dv);
        else await BleClient.write(ch.deviceId, ch.service, ch.characteristic, dv);
      } catch {
        // Connection dropped mid-print: reconnect once and resend this chunk.
        nativeConn.delete(printerId);
        const id = localStorage.getItem(devKey(printerId));
        if (!id) throw new Error('Printer Bluetooth terputus.');
        ch = await nativeOpen(printerId, id);
        if (ch.noResp) await BleClient.writeWithoutResponse(ch.deviceId, ch.service, ch.characteristic, dv);
        else await BleClient.write(ch.deviceId, ch.service, ch.characteristic, dv);
      }
      await new Promise((r) => setTimeout(r, ch.noResp ? 30 : 10));
    }
    return;
  }
  const ch = await reconnect(printerId);
  if (!ch) throw new Error('Printer Bluetooth belum terhubung. Buka Pengaturan Printer → Hubungkan.');
  for (let i = 0; i < data.length; i += chunk) {
    const part = data.slice(i, i + chunk);
    if (ch.properties.writeWithoutResponse) await ch.writeValueWithoutResponse(part);
    else await ch.writeValue(part);
    await new Promise((r) => setTimeout(r, 15));
  }
};

/** True when this printer should be served over Bluetooth and is reachable. */
export const btReady = async (printerId: string) => {
  if (!btSupported() || !btSavedName(printerId)) return false;
  if (isNative() && savedSpp(printerId)) return true;
  try { return isNative() ? !!(await nativeReconnect(printerId)) : !!(await reconnect(printerId)); } catch { return false; }
};

// ---------- Encoders ----------
const ascii = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e\n]/g, '');
const enc = (s: string) => new TextEncoder().encode(ascii(s));
const concat = (parts: (Uint8Array | number[])[]) => {
  const arrs = parts.map((p) => (p instanceof Uint8Array ? p : Uint8Array.from(p)));
  const out = new Uint8Array(arrs.reduce((n, a) => n + a.length, 0));
  let o = 0; arrs.forEach((a) => { out.set(a, o); o += a.length; });
  return out;
};

/** Minimal ESC/POS builder for 58/80mm thermal printers. */
export class EscPos {
  private parts: (Uint8Array | number[])[] = [[0x1b, 0x40]];
  constructor(public cols = 32) {}
  align(a: 'l' | 'c' | 'r') { this.parts.push([0x1b, 0x61, a === 'l' ? 0 : a === 'c' ? 1 : 2]); return this; }
  bold(on: boolean) { this.parts.push([0x1b, 0x45, on ? 1 : 0]); return this; }
  size(w: 1 | 2, h: 1 | 2) { this.parts.push([0x1d, 0x21, ((w - 1) << 4) | (h - 1)]); return this; }
  line(s = '') { this.parts.push(enc(s + '\n')); return this; }
  hr(ch = '-') { return this.line(ch.repeat(this.cols)); }
  row(l: string, r: string) {
    const L = ascii(l), R = ascii(r), space = this.cols - R.length - 1;
    const head = L.length > space ? L.slice(0, space) : L;
    return this.line(head + ' '.repeat(Math.max(1, this.cols - head.length - R.length)) + R);
  }
  feed(n = 3) { this.parts.push([0x1b, 0x64, n]); return this; }
  cut() { this.parts.push([0x1d, 0x56, 0x42, 0x00]); return this; }
  bytes() { return concat(this.parts); }
}

const q = (s: string) => ascii(s).replace(/"/g, "'");

export interface TsplLabel { lines: { text: string; big?: boolean; bold?: boolean }[]; side?: string[]; qr?: string }

/** TSPL for label printers (Xprinter XP-420B etc). 203dpi = 8 dots/mm. */
export const tsplLabels = (labels: TsplLabel[], wMm = 33, hMm = 15, gapMm = 2, scale = 100, spacing = 1.25) => {
  const big2 = scale >= 125; const sp = spacing / 1.25;
  const W = wMm * 8, H = hMm * 8;
  let out = `SIZE ${wMm} mm,${hMm} mm\r\nGAP ${gapMm} mm,0 mm\r\nDIRECTION 1\r\nDENSITY 10\r\nSPEED 3\r\n`;
  const sideW = labels.some((l) => l.qr || l.side?.length) ? Math.round(W * 0.3) : 0;
  for (const l of labels) {
    out += 'CLS\r\n';
    let y = 4;
    for (const ln of l.lines) {
      const font = ln.big ? '2' : '1';
      const mul = ln.big && big2 ? 2 : 1;
      out += `TEXT 6,${y},"${font}",0,${mul},${mul},"${q(ln.text)}"\r\n`;
      if (ln.bold) out += `TEXT 7,${y},"${font}",0,${mul},${mul},"${q(ln.text)}"\r\n`;
      y += Math.round((ln.big ? (big2 ? 40 : 22) : 14) * sp);
      if (y > H - 10) break;
    }
    if (sideW) {
      const x = W - sideW + 2;
      if (l.qr) out += `QRCODE ${x},6,L,2,A,0,"${q(l.qr)}"\r\n`;
      (l.side || []).forEach((s, i) => { out += `TEXT ${x},${H - 14 - i * 12},"1",0,1,1,"${q(s).slice(0, 8)}"\r\n`; });
    }
    out += 'PRINT 1,1\r\n';
  }
  return enc(out);
};
