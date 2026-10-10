const SERVICE_UUID = '000018f0-0000-1000-8000-00805f9b34fb';
const CHARACTERISTIC_UUID = '00002af1-0000-1000-8000-00805f9b34fb';
const CHUNK_BYTES = 100;
const CHUNK_DELAY_MS = 20;

type CharacteristicLike = { writeValue(value: Uint8Array): Promise<void> };
type ServiceLike = { getCharacteristic(uuid: string): Promise<CharacteristicLike> };
type ServerLike = { getPrimaryService(uuid: string): Promise<ServiceLike> };
type DeviceLike = {
  id: string;
  name?: string | null;
  gatt?: {
    connected: boolean;
    connect(): Promise<ServerLike>;
    disconnect(): void;
  };
};
type BluetoothLike = {
  requestDevice(options: {
    filters?: Array<{ services: string[] }>;
    acceptAllDevices?: boolean;
    optionalServices: string[];
  }): Promise<DeviceLike>;
};

let printerDevice: DeviceLike | null = null;
let writeCharacteristic: CharacteristicLike | null = null;

function bluetoothApi(): BluetoothLike | null {
  return (navigator as Navigator & { bluetooth?: BluetoothLike }).bluetooth ?? null;
}

function publishState(): void {
  window.dispatchEvent(
    new CustomEvent('jokger:printer-state', {
      detail: printerDevice ? { id: printerDevice.id, name: printerDevice.name ?? '' } : null,
    }),
  );
}

export function supportsBluetoothPrinter(): boolean {
  return Boolean(bluetoothApi());
}

export function connectedPrinter(): { id: string; name: string } | null {
  if (!printerDevice?.gatt?.connected) return null;
  return { id: printerDevice.id, name: printerDevice.name ?? '' };
}

export async function connectPrinter(): Promise<{ id: string; name: string }> {
  const bluetooth = bluetoothApi();
  if (!bluetooth) throw new Error('Web Bluetooth tidak tersedia.');
  let device: DeviceLike;
  try {
    device = await bluetooth.requestDevice({
      filters: [{ services: [SERVICE_UUID] }],
      optionalServices: [SERVICE_UUID],
    });
  } catch {
    device = await bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [SERVICE_UUID],
    });
  }
  if (!device.gatt) throw new Error('Printer tidak menyediakan koneksi Bluetooth.');
  const server = await device.gatt.connect();
  const service = await server.getPrimaryService(SERVICE_UUID);
  writeCharacteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);
  printerDevice = device;
  publishState();
  return { id: device.id, name: device.name ?? '' };
}

export function disconnectPrinter(): void {
  if (printerDevice?.gatt?.connected) printerDevice.gatt.disconnect();
  printerDevice = null;
  writeCharacteristic = null;
  publishState();
}

export function subscribePrinterState(
  listener: (printer: { id: string; name: string } | null) => void,
): () => void {
  const handler = (event: Event) =>
    listener((event as CustomEvent<{ id: string; name: string } | null>).detail);
  window.addEventListener('jokger:printer-state', handler);
  return () => window.removeEventListener('jokger:printer-state', handler);
}

export async function writePrinterBytes(bytes: Uint8Array): Promise<void> {
  if (!connectedPrinter() || !writeCharacteristic) throw new Error('Printer tidak terhubung.');
  for (let offset = 0; offset < bytes.length; offset += CHUNK_BYTES) {
    await writeCharacteristic.writeValue(bytes.slice(offset, offset + CHUNK_BYTES));
    if (offset + CHUNK_BYTES < bytes.length) {
      await new Promise<void>((resolve) => window.setTimeout(resolve, CHUNK_DELAY_MS));
    }
  }
}
