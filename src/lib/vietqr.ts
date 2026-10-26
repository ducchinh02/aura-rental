// Mã VietQR (chuẩn EMVCo của Napas): app ngân hàng nào cũng quét được, điền sẵn tài khoản nhận,
// số tiền và nội dung. Tạo ngay trên máy, không gửi thông tin đơn cho dịch vụ bên ngoài.

const tlv = (id: string, value: string) => `${id}${String(value.length).padStart(2, "0")}${value}`;

// CRC-16/CCITT-FALSE theo chuẩn EMVCo (đa thức 0x1021, khởi tạo 0xFFFF)
export function crc16(input: string) {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Nội dung chuyển khoản chỉ nên có chữ không dấu, số và dấu gạch */
export function vietQrPayload({ bin, account, amount, message }: { bin: string; account: string; amount: number; message: string }) {
  const beneficiary = tlv("00", "A000000727") + tlv("01", tlv("00", bin) + tlv("01", account)) + tlv("02", "QRIBFTTA");
  const body =
    tlv("00", "01") +
    tlv("01", "12") + // QR động: có số tiền
    tlv("38", beneficiary) +
    tlv("53", "704") + // VND
    tlv("54", String(Math.round(amount))) +
    tlv("58", "VN") +
    tlv("62", tlv("08", message.replace(/[^A-Za-z0-9 -]/g, "").slice(0, 50))) +
    "6304";
  return body + crc16(body);
}
