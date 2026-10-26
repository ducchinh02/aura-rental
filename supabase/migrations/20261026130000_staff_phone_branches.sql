-- Số điện thoại nhân viên; thêm / ngưng cơ sở an toàn.

-- ---------------------------------------------------------------------------
-- Nhân viên có số điện thoại (chuẩn hoá giống SĐT khách)
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column phone text check (phone is null or phone ~ '^0\d{9,10}$');

create function private.profiles_normalize_phone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.phone := nullif(private.normalize_phone(new.phone), '');
  return new;
end;
$$;

create trigger profiles_normalize_phone
  before insert or update of phone on public.profiles
  for each row execute function private.profiles_normalize_phone();

-- Tài khoản tạo qua Admin API: tên và SĐT trong user_metadata, vai trò / cơ sở trong app_metadata
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone, role, branch_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    coalesce((new.raw_app_meta_data ->> 'role')::public.app_role, 'staff'),
    (new.raw_app_meta_data ->> 'branch_id')::uuid
  );
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Cơ sở
-- ---------------------------------------------------------------------------

alter table public.branches
  add constraint branches_code_format check (code ~ '^[A-Z0-9]{2,6}$');

-- Ngưng hoạt động thì cơ sở biến khỏi mọi trang, nên chỉ cho phép khi không còn gì gắn với nó
create function private.branches_guard_deactivate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.inventory_items where home_branch_id = new.id and status <> 'retired') then
    raise exception 'Cơ sở % còn váy trong kho. Đổi kho gốc các chiếc váy sang cơ sở khác trước.', new.code
      using hint = 'branch_in_use';
  end if;
  if exists (
    select 1 from public.bookings
    where branch_id = new.id and status in ('pending', 'confirmed', 'picked_up', 'returned')
  ) then
    raise exception 'Cơ sở % còn đơn đang xử lý.', new.code using hint = 'branch_in_use';
  end if;
  if exists (select 1 from public.profiles where branch_id = new.id and is_active) then
    raise exception 'Cơ sở % còn nhân viên. Chuyển nhân viên sang cơ sở khác hoặc khoá tài khoản trước.', new.code
      using hint = 'branch_in_use';
  end if;
  return new;
end;
$$;

create trigger branches_guard_deactivate
  before update of is_active on public.branches
  for each row
  when (old.is_active and not new.is_active)
  execute function private.branches_guard_deactivate();
