declare module '@point-of-sale/receipt-printer-encoder' {
  export default class ReceiptPrinterEncoder {
    initialize(): this;
    align(value: 'left' | 'center' | 'right'): this;
    size(width: number, height: number): this;
    text(value: string): this;
    newline(lines?: number): this;
    cut(value?: 'full' | 'partial'): this;
    encode(): Uint8Array;
  }
}
