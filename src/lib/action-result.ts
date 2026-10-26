export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type DbError = { message: string; code?: string } | null;

// Lỗi nghiệp vụ (P0001 / 42501 do function trong DB raise) đã viết sẵn tiếng Việt
export function dbErrorMessage(error: DbError) {
  if (!error) return "Có lỗi xảy ra, thử lại sau";
  switch (error.code) {
    case "P0001":
      return error.message;
    case "42501":
      return /permission denied|row-level security/i.test(error.message)
        ? "Bạn không có quyền làm việc này"
        : error.message;
    case "23P01":
      return "Váy đã có lịch trong khoảng ngày này";
    case "23505":
      return "Mã hoặc đường dẫn này đã tồn tại";
    case "23514":
      return "Dữ liệu không hợp lệ, kiểm tra lại các ô đã nhập";
    default:
      console.error(error);
      return "Có lỗi xảy ra, thử lại sau";
  }
}

export function fail(error: string): ActionResult<never> {
  return { ok: false, error };
}

export function ok(): ActionResult;
export function ok<T>(data: T): ActionResult<T>;
export function ok<T>(data?: T): ActionResult<T | undefined> {
  return { ok: true, data };
}
