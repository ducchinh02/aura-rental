-- Tài khoản đăng nhập để chạy thử ở LOCAL (không phải dữ liệu shop). Mật khẩu: aura123456
--   owner@aura.local   chủ shop
--   nv.hn@aura.local   nhân viên Hà Nội
--   nv.sg@aura.local   nhân viên Sài Gòn
-- Trên production chủ shop tạo tài khoản thật ở Cài đặt → Tài khoản.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('aura123456', extensions.gen_salt('bf')), now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')) || u.app_meta,
  jsonb_build_object('full_name', u.full_name), now(), now(),
  '', '', '', ''
from (values
  ('aaaaaaaa-0000-4000-8000-000000000001'::uuid, 'owner@aura.local', 'Chủ shop', '{"role": "owner"}'::jsonb),
  ('aaaaaaaa-0000-4000-8000-000000000002'::uuid, 'nv.hn@aura.local', 'Nhân viên Hà Nội',
    '{"role": "staff", "branch_id": "11111111-1111-4111-8111-111111111111"}'::jsonb),
  ('aaaaaaaa-0000-4000-8000-000000000003'::uuid, 'nv.sg@aura.local', 'Nhân viên Sài Gòn',
    '{"role": "staff", "branch_id": "22222222-2222-4222-8222-222222222222"}'::jsonb)
) as u (id, email, full_name, app_meta);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select
  gen_random_uuid(), id, id::text,
  jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
  'email', now(), now(), now()
from auth.users
where email like '%@aura.local';
