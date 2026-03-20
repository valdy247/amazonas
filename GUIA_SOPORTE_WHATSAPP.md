# GUIA OPERATIVA DE SOPORTE

Esta guia es para la persona que atendera usuarios mientras el sistema este funcionando normal.

No hace falta programar.
No hace falta tocar base de datos.
No hace falta entrar a Vercel, GitHub ni Supabase, salvo que el dueño lo pida.

Objetivo:
- Responder dudas
- Resolver casos desde el panel admin
- Detectar cuando algo ya no es un caso normal y debe escalarse

## 1. Reglas basicas

1. Nunca prometer algo que no se haya verificado.
2. Nunca pedir contraseñas al usuario.
3. Nunca cambiar correos o estados si no se entiende el caso.
4. Siempre revisar primero:
   nombre del usuario, correo, tipo de problema y capturas.
5. Si el usuario esta molesto:
   responder corto, claro y con siguiente paso concreto.

## 2. Herramientas que si puede usar

- Panel admin
- Panel de soporte dentro de la web
- Correo de soporte
- WhatsApp de soporte si existe
- PayPal y Square solo para confirmar si el usuario dice que pago
- Veriff solo para revisar si la verificacion aparece aprobada, rechazada o en revision

## 3. Checklist diario

Hacer esto al iniciar turno:

1. Entrar a `Admin > Resumen`
2. Revisar:
   - Soportes abiertos
   - Pagos pendientes o validando
   - KYC en revision
   - Fallos recientes de webhook
3. Entrar a `Admin > Soporte`
4. Tomar casos nuevos
5. Revisar `Admin > Usuarios` para usuarios con:
   - pago activo pero acceso raro
   - KYC aprobado pero cuenta bloqueada
   - correo cambiado
6. Revisar si hay reportes de proveedores o solicitudes de eliminacion

## 4. Informacion que siempre hay que pedir al usuario

Antes de tocar nada, pedir:

- Correo con el que se registro
- Nombre completo
- Captura del error
- Que estaba intentando hacer
- Si pago:
  fecha, monto, metodo y captura
- Si es KYC:
  si ya termino Veriff o si quedo en revision

## 5. Casos comunes y como resolverlos

## A. No puedo entrar a mi cuenta

Preguntar:
- Te sale error o solo no entra
- Estas usando el correo correcto
- Ya verificaste el correo

Resolver:
1. Buscar al usuario en `Admin > Usuarios`
2. Confirmar que exista el correo
3. Si olvido la contraseña:
   enviar restablecimiento desde admin
4. Si el usuario dice que verifico el correo pero sigue raro:
   pedir que cierre sesion y vuelva a entrar
5. Si la cuenta no existe:
   decirle que se registre con el correo correcto

Escalar:
- Si el correo existe pero no deja iniciar aunque la cuenta se vea normal
- Si el enlace de restablecer vuelve a fallar varias veces

## B. Ya pague y no tengo membresia activa

Preguntar:
- Captura del pago
- Fecha
- Correo de la cuenta

Resolver:
1. Buscar usuario en `Admin > Usuarios`
2. Revisar membresia:
   - `active`
   - `pending_payment`
   - `payment_processing`
   - `payment_failed`
3. Si pago confirmado y el sistema no activo:
   actualizar la membresia manualmente si el pago es real
4. Decirle al usuario que cierre sesion y vuelva a entrar

Escalar:
- Si hay muchos casos iguales el mismo dia
- Si no aparece el pago en Square
- Si hay varios `webhook` fallando en resumen/admin notificaciones

## C. Volvi de Square y no se activo

Esto normalmente significa:
- no termino de pagar
- o el pago aun no fue confirmado

Resolver:
1. Verificar estado real de la membresia
2. Si sigue en `payment_processing`, esperar confirmacion corta
3. Si ya esta confirmado, activar manual si hace falta
4. Si no pago, explicarle que debe completar el checkout

## D. Mi verificacion de identidad no avanza

Preguntar:
- Ya terminaste Veriff
- Que mensaje te sale
- Cuando lo hiciste

Resolver:
1. Revisar `KYC status` del usuario
2. Si esta en `approved`:
   decirle que cierre sesion y vuelva a entrar
3. Si esta en `in_review`:
   explicarle que sigue en revision
4. Si esta en `rejected`:
   explicar que debe repetir el proceso si esa opcion existe

Escalar:
- Si Veriff dice aprobado pero la cuenta sigue sin acceso
- Si el nombre o fecha de nacimiento se ven incorrectos
- Si hay muchos usuarios atorados en `in_review`

## E. No veo proveedores

Preguntar:
- Ya pagaste
- Ya aprobaste verificacion
- Que mensaje exacto te sale

Resolver:
1. Revisar membresia
2. Revisar KYC
3. Confirmar que acepto terminos
4. Si todo esta bien y aun no ve proveedores:
   pedir cerrar sesion y volver a entrar

Recordatorio:
- Reviewer/tester necesita membresia activa y KYC aprobado
- Admin siempre puede ver todo

## F. Problemas con proveedores

Casos tipicos:
- No responde
- No es proveedor real
- Estafa
- Contacto roto

Resolver:
1. Pedir evidencia o captura
2. Revisar reportes del proveedor
3. Marcar o actualizar revision del contacto en admin
4. Si hay varios reportes de riesgo:
   dejar nota clara

Escalar:
- Si parece estafa fuerte
- Si afecta a varias personas
- Si requiere borrar o ocultar contactos en masa

## G. Soporte de referidos

Preguntar:
- Correo de quien refiere
- Correo del referido
- Captura del link o codigo

Explicar:
- El bono solo cuenta cuando el referido cumple condiciones validas
- No siempre se refleja al instante

Resolver:
1. Buscar al usuario que refirio
2. Ver si tiene codigo de referido
3. Buscar al referido
4. Revisar si el referido ya:
   - confirmo email
   - tiene membresia con acceso
   - tiene KYC aprobado
5. Si cumple y aun no se ve reflejado:
   dejar nota y escalar

## H. Cambio de correo

Resolver:
1. Verificar identidad minima del usuario
2. Confirmar correo viejo y nuevo
3. Cambiar desde admin solo si el caso es claro
4. Avisar al usuario que vuelva a iniciar sesion con el correo nuevo

Escalar:
- Si hay duda de suplantacion
- Si el usuario no puede demostrar que la cuenta es suya

## I. Restablecer contraseña

Resolver:
1. Confirmar correo
2. Enviar recuperacion desde admin
3. Decirle que use el correo mas reciente enviado
4. Revisar spam/promociones

Si el usuario dice:
"me lleva al inicio"
- pedir que use el enlace mas nuevo
- si sigue igual, escalar

## 6. Estados que debe entender

Membresia:
- `pending_payment`: aun no ha pagado
- `payment_processing`: pago iniciado o validandose
- `active`: con acceso
- `payment_failed`: pago fallido
- `canceled`: cancelada
- `suspended`: suspendida

KYC:
- `pending`: aun no inicia o no termina
- `in_review`: necesita revision
- `approved`: aprobado
- `rejected`: rechazado

Soporte:
- `open`: nuevo
- `in_progress`: tomado por soporte
- `resolved`: resuelto

## 7. Cuándo NO resolver sola y debe escalar

Escalar de inmediato si pasa cualquiera de estas:

1. Muchos usuarios reportan el mismo problema
2. No llegan correos de forma masiva
3. Los pagos no activan membresia en varios casos
4. Square o Veriff parecen caidos
5. La web no carga o se ve rota
6. El admin no deja guardar cambios
7. Aparecen muchos fallos de webhook
8. Un usuario amenaza con chargeback, disputa o fraude
9. Sospecha de acceso no autorizado a una cuenta
10. Hay que borrar o editar datos masivamente

## 8. Mensajes cortos listos para usar

### Pago en revision
Hola. Aun estamos validando tu pago. Si ya pagaste, envianos por favor la captura y el correo de tu cuenta para revisarlo.

### Password reset
Hola. Ya te enviamos un correo para restablecer tu contraseña. Revisa bandeja principal, spam y promociones. Usa siempre el enlace mas reciente.

### KYC en revision
Hola. Tu verificacion aun aparece en revision. Cuando cambie el estado te avisaremos o podras verlo al entrar a tu cuenta.

### Falta completar pago
Hola. En este momento tu membresia aun no aparece activa. Parece que el pago no se completo o no fue confirmado todavia. Si ya pagaste, envianos la captura.

### Falta informacion
Para ayudarte necesito estos datos:
- correo de tu cuenta
- captura del error
- que estabas intentando hacer

### Caso tomado
Hola. Ya tome tu caso y lo estoy revisando. Te escribo apenas tenga confirmacion.

## 9. Errores de operacion que debe evitar

- No activar membresias sin evidencia de pago
- No aprobar KYC manualmente por presion del usuario si el caso no esta claro
- No borrar proveedores por una sola queja sin revisar
- No cambiar correos o nombres por mensajes informales sin validar
- No decir "ya esta resuelto" sin pedir al usuario que pruebe

## 10. Cierre correcto de un caso

Antes de marcar como resuelto:

1. Confirmar que el cambio se hizo
2. Decirle al usuario que pruebe otra vez
3. Esperar confirmacion si el caso era delicado
4. Dejar nota interna corta si fue un caso raro

## 11. Si el sistema se ve estable pero algo huele mal

Aunque la web cargue, escalar si notas:

- demasiados pagos en `payment_processing`
- demasiados KYC en `in_review`
- correos que nadie recibe
- soporte sin mensajes en tiempo real
- usuarios que dicen que sus datos desaparecieron
- aumento raro de quejas por referidos o acceso

## 12. Resumen final

Tu trabajo no es programar.
Tu trabajo es:

1. identificar bien el caso
2. revisar el usuario correcto
3. resolver lo que si esta dentro del panel admin
4. escalar rapido cuando ya parece falla del sistema

Si dudas entre tocar algo o escalar:
mejor escalar.
