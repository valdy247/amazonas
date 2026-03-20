# GUIA DE INCIDENTES SERIOS

Esta guia es para cuando el problema ya NO es normal.

Esta persona no necesita programar.
Pero si necesita saber:
- cuando revisar Vercel
- cuando revisar Resend
- cuando revisar Supabase
- cuando pedirme ayuda
- cuando pegar un SQL puntual

Objetivo:
- detectar rapido una falla real del sistema
- no perder tiempo probando cosas equivocadas
- saber que informacion traer antes de pedirme ayuda

## 1. Regla principal

Si el problema afecta a varias personas al mismo tiempo, ya no es un caso individual.

Eso es un incidente.

En ese caso:
1. no seguir respondiendo caso por caso como si fuera problema del usuario
2. confirmar si se repite
3. revisar paneles
4. juntar evidencia
5. escribirme con la informacion correcta

## 2. Herramientas que puede revisar

## Vercel

Usarlo para:
- ver si el deploy fallo
- ver si una ruta API esta rompiendo
- ver errores del build
- ver errores del runtime

## Resend

Usarlo para:
- ver si los correos estan saliendo
- ver si los correos estan fallando
- ver si hubo bloqueo o limite

## Supabase

Usarlo para:
- ver si la base esta viva
- ver si falta una columna o tabla
- revisar SQL puntual que ya este listo
- ver Auth, usuarios y algunos errores

## Aqui conmigo

Pedirme ayuda cuando:
- haya errores raros
- no sepas si el problema es frontend, backend o base de datos
- haya que revisar logs
- haya que corregir algo
- haya que generar SQL

## 3. Datos que siempre debe traer antes de pedir ayuda

Si me va a escribir, debe traer:

1. que esta fallando exactamente
2. desde cuando pasa
3. si afecta a una persona o a muchas
4. correo de ejemplo de un usuario afectado
5. captura del error
6. si pasa en web, en movil o en ambos
7. si hubo deploy reciente
8. captura de Vercel si hay error
9. captura de Resend si es correo
10. captura de Supabase si el error menciona DB, columnas o permisos

## 4. Incidentes serios mas probables

## A. La web no carga o carga rota

Señales:
- pantalla en blanco
- error 500
- botones que no hacen nada
- varias personas reportan lo mismo

Que revisar:
1. abrir la web en incognito
2. revisar si solo falla una pagina o toda la web
3. entrar a Vercel
4. abrir el proyecto
5. revisar:
   - ultimo deploy
   - si esta `Ready` o `Error`
   - logs de runtime

Cuando escribirme:
- si Vercel muestra errores
- si el deploy reciente coincide con el inicio del problema
- si la pagina principal no abre

Mensaje util para mi:
- "La web falla para varios usuarios. Empezo hoy a X hora. Ultimo deploy: listo/error. Ruta afectada: /admin o /dashboard. Adjunto captura."

## B. El deploy fallo en Vercel

Señales:
- status `Error`
- build fallido
- no sale la nueva version

Que revisar:
1. Vercel
2. entrar al deploy fallido
3. bajar hasta el error final
4. copiar solo:
   - archivo
   - linea
   - mensaje final

No hacer:
- no reintentar diez veces sin entender
- no cambiar variables sin saber

Cuando escribirme:
- siempre que el deploy este en `Error`

Mensaje util:
- "Fallo deploy en Vercel. Archivo: X. Linea: Y. Error: Z. Commit si aparece: X."

## C. Los correos no estan llegando

Casos:
- restablecer contraseña
- correos de soporte
- correos de membresia o recuperacion

Señales:
- varias personas no reciben nada
- en soporte dicen "no me llega"
- Resend muestra errores

Que revisar:
1. confirmar que no sea solo un usuario
2. entrar a Resend
3. revisar:
   - si los correos salen como `Delivered`
   - `Bounced`
   - `Failed`
   - `Suppressed`
4. revisar si el dominio sigue verificado

Cuando escribirme:
- si varios correos fallan
- si Resend marca error
- si no aparecen correos nuevos en Resend

Cosas que puede decir al usuario mientras tanto:
- "Estamos revisando una incidencia con correos. En cuanto quede estable te reenviamos el acceso."

## D. Los pagos no activan membresia

Señales:
- varios usuarios dicen "ya pague y sigo igual"
- demasiados en `payment_processing`
- no cambia a `active`

Que revisar:
1. `Admin > Resumen`
2. ver si subieron mucho:
   - `payment_processing`
   - `payment_failed`
3. revisar si tambien hay `webhook failures`
4. si puede, revisar en Square si el cobro si existe

Cuando escribirme:
- si afecta a varias personas
- si hay webhooks fallando
- si pagos reales no activan

Esto suele ser:
- webhook no llego
- webhook fallo
- desajuste de DB

## E. La verificacion KYC no avanza para muchos

Señales:
- muchos usuarios se quedan en `in_review`
- Veriff dice aprobado pero la web no cambia
- varios casos en poco tiempo

Que revisar:
1. `Admin > Resumen`
2. `Admin > Usuarios`
3. mirar si el patron se repite
4. si tienen `approved` en KYC pero sin acceso, juntar ejemplos

Cuando escribirme:
- si se repite en varios usuarios
- si parece que webhook de Veriff no esta entrando

## F. Soporte en tiempo real no actualiza

Señales:
- en movil se ve y en web no
- los mensajes no refrescan
- soporte dice que el chat se congela

Que revisar:
1. confirmar si pasa solo en una vista o en todas
2. refrescar navegador
3. probar incognito
4. revisar si pasa con varios usuarios

Cuando escribirme:
- si es patron general
- si mensajes llegan a DB pero no se ven
- si el soporte queda sin comunicacion

## G. Error de base de datos o schema cache

Señales tipicas:
- `Could not find the 'X' column of 'Y' in the schema cache`
- `column does not exist`
- `constraint` error
- `relation does not exist`

Esto normalmente significa:
- falta aplicar SQL en Supabase
- el codigo ya espera una columna nueva

Que hacer:
1. no entrar en panico
2. sacar captura completa
3. copiar nombre exacto de:
   - tabla
   - columna
   - constraint
4. escribirme eso exacto

Solo si yo ya deje el SQL listo, puede pegarlo en Supabase SQL Editor.

No inventar SQL.

## H. Login o reset de contraseña rotos para varios usuarios

Señales:
- nadie puede restablecer
- el enlace lleva al lugar incorrecto
- login falla para varios usuarios

Que revisar:
1. si es solo una cuenta o muchas
2. si los correos de reset salen desde Resend
3. si el enlace viene en el correo
4. si el usuario esta usando el correo mas nuevo

Cuando escribirme:
- si el patron es general
- si los enlaces estan malos
- si no llegan correos o llegan sin link

## I. Admin no puede guardar cambios

Señales:
- no guarda usuario
- no actualiza membresia
- no crea proveedor
- no deja tomar caso

Que revisar:
1. si es solo una accion o varias
2. si aparece mensaje exacto
3. si pasa a todos los admins o solo a uno

Cuando escribirme:
- siempre que una accion de admin deje de guardar

## J. Problema con variables o credenciales

Señales:
- errores como:
  - `Missing RESEND_API_KEY`
  - `Missing VERIFF_API_KEY`
  - `Missing SQUARE_ACCESS_TOKEN`
  - `Missing SUPABASE_SERVICE_ROLE_KEY`

Esto significa:
- falta variable en Vercel
- la variable se borro
- se cambio el entorno

Que revisar:
1. Vercel
2. Project Settings
3. Environment Variables
4. confirmar si existe la variable exacta

No cambiar valores a mano si no sabes cuales van.

Cuando escribirme:
- siempre

## 5. Cosas que puede revisar en Vercel

Checklist rapido:

1. proyecto correcto
2. ultimo deploy
3. status:
   - `Ready`
   - `Building`
   - `Error`
4. logs del deploy
5. logs de funciones si la web abre pero una API falla
6. variables de entorno si el error dice `Missing ...`

## 6. Cosas que puede revisar en Resend

Checklist rapido:

1. si el correo aparece en la lista
2. estado del correo
3. si falla solo un destinatario o todos
4. si el dominio sigue verificado
5. si hay rebotes o bloqueos

## 7. Cosas que puede revisar en Supabase

Sin tocar cosas raras.

Puede revisar:
1. SQL Editor, solo si ya tiene un SQL listo y confirmado
2. Table Editor para mirar si una fila existe
3. Auth para confirmar si existe el usuario
4. Logs si sabe exactamente que esta buscando

No debe:
- borrar tablas
- correr SQL inventado
- cambiar policies
- tocar RLS
- cambiar constraints

## 8. SQLs puntuales que algun dia puede necesitar pegar

Solo si el error coincide EXACTAMENTE.

## Caso 1. Falta `source_language` en `support_messages`

Error tipico:
- `Could not find the 'source_language' column of 'support_messages' in the schema cache`

SQL:

```sql
alter table public.support_messages
add column if not exists source_language text default 'es';

alter table public.support_messages
add column if not exists translations jsonb default '{}'::jsonb;

alter table public.support_messages
drop constraint if exists support_messages_source_language_check;

alter table public.support_messages
add constraint support_messages_source_language_check
check (source_language in ('es', 'en'));
```

## Caso 2. Falta `date_of_birth` en `kyc_checks`

Error tipico:
- `column date_of_birth does not exist`

SQL:

```sql
alter table public.kyc_checks
add column if not exists date_of_birth date;
```

## Caso 3. Soporte con motivo `referrals` falla

Si el error dice que `category` no permite ese valor:

SQL:

```sql
alter table public.support_threads
drop constraint if exists support_threads_category_check;

alter table public.support_threads
add constraint support_threads_category_check
check (category in ('general', 'payment', 'verification', 'chat', 'account', 'provider', 'referrals', 'bug'));
```

Importante:
- correr una sola vez
- esperar unos segundos
- refrescar la app

## 9. Como escribirme un incidente

Usar este formato:

### Plantilla corta

Incidente:
Cuando empezo:
Afecta a cuantos usuarios:
Ruta afectada:
Mensaje exacto:
Captura:
Que revise:
Vercel:
Resend:
Supabase:
Usuario ejemplo:

## 10. Semaforo de gravedad

## Verde

Caso individual.
Se resuelve desde admin.

Ejemplos:
- reset de un usuario
- pago aislado
- un proveedor reportado

## Amarillo

Hay patron, pero la web sigue viva.

Ejemplos:
- varios pagos tardan
- varios correos no llegan
- varios KYC atorados

Accion:
- juntar evidencia
- avisarme pronto

## Rojo

Problema masivo o caida.

Ejemplos:
- la web no abre
- deploy roto
- admin no guarda
- pagos no activan a nadie
- no sale ningun correo

Accion:
1. dejar de responder como si fuera caso individual
2. avisarme de inmediato
3. mandar capturas y datos

## 11. Cosas que nunca debe hacer en un incidente

- no pegar SQL que no entienda
- no cambiar variables de entorno por intuicion
- no borrar usuarios
- no reiniciar cosas al azar
- no decirle a todos los usuarios algo distinto
- no ocultar que hay un problema general

## 12. Mensajes utiles para usuarios durante incidente

### Incidencia de pagos
Hola. Estamos revisando una incidencia general con la activacion de membresias. Si ya pagaste, tu caso esta siendo validado y te avisaremos apenas quede corregido.

### Incidencia de correos
Hola. Estamos revisando un problema temporal con el envio de correos. En cuanto quede estable te enviaremos nuevamente el acceso o la recuperacion.

### Incidencia de sistema
Hola. Estamos revisando una incidencia tecnica en la plataforma. Ya fue escalada. Gracias por tu paciencia.

## 13. Regla final

Si el problema:
- afecta a muchos
- aparece de golpe
- tiene mensaje tecnico
- menciona columnas, webhooks, variables, build, runtime, deploy, resend o vercel

entonces:

no es soporte comun.

Es incidente serio.
Y debe escalarse rapido con evidencia.
