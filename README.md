# TestHub Comunidad (Mobile First)

Web app para testers y proveedores con flujo: registro -> pago Square -> KYC -> acceso a contactos.

## Stack
- Next.js 16 + TypeScript + Tailwind CSS v4
- Supabase (Auth + Postgres + RLS)
- Vercel (deploy)
- Square (payment link + webhook pendiente)

## Checklist del proyecto
- [x] Base Next.js creada
- [x] UI mobile-first + responsive fallback
- [x] Home moderna con `hero.png`
- [x] Header con `Mi cuenta` -> crear cuenta / iniciar sesión
- [x] Registro e inicio de sesión con Supabase
- [x] Onboarding de rol (`tester` / `provider`)
- [x] Dashboard con flujo por estados (membresía/KYC)
- [x] Panel admin protegido por rol
- [x] Crear nuevos admins desde panel
- [x] Cargar contactos de proveedores desde panel
- [x] SQL de Supabase con tablas + RLS
- [ ] Confirmación automática de pago Square por webhook
- [ ] Integración KYC real (Persona/Sumsub/Metamap)
- [ ] Términos y políticas legales finales
- [ ] Hardening de seguridad y auditoría completa

## Estructura
- `app/page.tsx`: Home
- `app/auth/page.tsx`: login/registro
- `app/onboarding/page.tsx`: selección de rol
- `app/dashboard/page.tsx`: panel de usuario
- `app/admin/page.tsx`: panel admin
- `app/api/square/webhook/route.ts`: endpoint webhook (placeholder)
- `supabase/schema.sql`: esquema inicial DB + políticas

## Variables de entorno (`.env.local`)
```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SQUARE_PAYMENT_LINK=
```

## Configuración rápida
1. Instala dependencias
```bash
npm install
```
2. Carga `supabase/schema.sql` en SQL Editor de Supabase.
3. Crea un usuario y desde SQL ponlo admin:
```sql
update public.profiles set role = 'admin' where email = 'tu-correo@dominio.com';
```
4. Ejecuta local:
```bash
npm run dev
```
5. Deploy en Vercel y configura las mismas env vars.

## Flujo actual
1. Usuario entra y crea cuenta.
2. Elige si es tester/proveedor.
3. En dashboard paga por Square.
4. Admin marca `membership=active` y estado KYC.
5. Si KYC aprobado, ve contactos de proveedores.

## Próximo paso recomendado
Implementar webhook real de Square para cambiar membresía de forma automática y reducir trabajo manual de admin.

