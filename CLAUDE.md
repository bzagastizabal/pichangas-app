# Proyecto: Plataforma de Gestión de Pichangas 🏀

Contexto para Claude Code. Este archivo resume las decisiones de arquitectura
y el estado del proyecto. Léelo antes de proponer o escribir código.

## Qué es
Plataforma web/móvil para organizar "pichangas" (partidos informales de
básquet) de un grupo cerrado, hoy coordinado por WhatsApp. Automatiza la
inscripción y la validación de pagos (Yape/Plin/banco) para eliminar la
gestión manual.

## Stack tecnológico (ya decidido — no cambiar sin justificación)
- **Frontend + Backend:** Next.js (App Router, TypeScript, Tailwind), un solo proyecto.
- **Base de datos + Auth + Storage:** Supabase (PostgreSQL).
- **Despliegue:** Vercel (plan Hobby gratuito).
- **Tareas programadas:** pg_cron / Edge Functions de Supabase (para expiración de cupos).
- Objetivo de costo: ~$0/mes en pruebas. Prioridades: 1) bajo costo, 2) lanzar rápido, 3) escalable.

## Decisiones de diseño clave (importantes)
- La tabla central se llama **`eventos`** (no `pichangas`) con campo `tipo_deporte`,
  para escalar a otros deportes. La UI muestra "pichanga".
- **`inscripciones` y `pagos` son tablas SEPARADAS.** Una inscripción es "reservé
  cupo"; un pago es "subí comprobante". Esto permite tener morosos (inscritos sin pago).
- **Validación de pagos: MANUAL.** El admin aprueba el comprobante con un clic.
- **Regla "el que paga primero gana el cupo":** el orden se decide por
  `pagos.fecha_subida` (cuándo el usuario subió la captura), NUNCA por
  `fecha_validacion` (cuándo el admin aprobó). El admin solo certifica que el
  comprobante es real; el sistema decide a quién le toca el cupo.
- **Retención de comprobantes:** la IMAGEN se borra a los ~60 días (cron), pero el
  REGISTRO del pago en la tabla `pagos` queda para siempre (historial financiero).
  Campos: `fecha_borrado_comprobante`, `comprobante_eliminado`, `url_comprobante` (NULL tras borrar).

## Modelo de datos (ya creado en Supabase)
Tablas: `perfiles` (1-a-1 con auth.users vía trigger on_auth_user_created),
`sedes`, `arbitros`, `eventos`, `inscripciones`, `pagos`.
- `perfiles.rol` ENUM: 'participante' | 'administrador'. Función `es_admin()` para RLS.
- `sedes` y `arbitros` tienen `precio_por_hora`. (arbitros conserva `tarifa_partido` opcional.)
- `eventos`: sede_id, arbitro_id, admin_id, fecha_hora_evento, fecha_hora_limite_pago,
  duracion_horas (pasos de media hora), cupos_totales, minimo_requerido, costo_sede,
  costo_arbitraje, porcentaje_ganancia, costo_por_participante (calculado),
  slug_inscripcion (UNIQUE, para enlace directo).
  Al crear, costo_sede/costo_arbitraje se importan como precio_por_hora*duracion_horas (editables).
- `inscripciones.estado` ENUM: 'pendiente' | 'confirmado' | 'lista_espera' | 'expirado' | 'liberado'.
- `pagos.estado` ENUM: 'en_revision' | 'aprobado' | 'rechazado'. metodo: 'yape'|'plin'|'banco'.
- **Row Level Security ACTIVO en todas las tablas.** Participante ve solo lo suyo;
  admin (es_admin()) ve y gestiona todo. Las políticas ya están creadas.

## Cálculo de costo por participante
costo_por_participante = (costo_sede + costo_arbitraje) * (1 + porcentaje_ganancia/100) / cupos_totales
(Se divide entre cupos TOTALES, asumiendo que el evento se llena. minimo_requerido
decide si la pichanga se realiza o se cancela.)

## Lógica de cupos (a implementar con transacciones FOR UPDATE)
- Inscribirse: contar (pendiente+confirmado); si hay espacio -> 'pendiente', si no -> 'lista_espera'.
- Aprobar pago: si no hay cupo confirmado, desplazar a un 'pendiente' cuyo comprobante
  sea más nuevo (o no tenga) que el que paga. Notificar al desplazado ('liberado').
- Cron de expiración (~cada 5 min): 'pendiente' vencidos -> 'expirado', y promover
  al primero de 'lista_espera' dándole nueva ventana de pago.
- TODA transición que afecte disponibilidad va en transacción con FOR UPDATE sobre el evento.

## Estado actual del proyecto
- [HECHO] Esquema SQL corrido en Supabase (tablas + trigger + RLS + índices).
- [HECHO] Proyecto Next.js creado con @supabase/supabase-js y @supabase/ssr.
- [HECHO] Conexión Supabase: src/lib/supabase/client.ts y server.ts.
- [HECHO] Registro (/registro), Login (/login), Dashboard protegido (/dashboard).
- [HECHO] src/proxy.ts refresca la sesión (antes middleware.ts; renombrado por la deprecación middleware->proxy de Next 16).
- [HECHO] Login verificado: el dashboard muestra nombre y rol del usuario.
- [HECHO] CRUD de sedes y arbitros: panel admin en /admin (layout protegido solo-admin,
  Server Actions con doble barrera requireAdmin()+RLS, soft-delete via `activo` + borrado).
  Helpers: src/lib/auth.ts (getSesion/requireAdmin) y src/lib/types.ts.
- [HECHO] Fase 2: CRUD de eventos en /admin/eventos (cálculo de costo en vivo, duración en
  pasos de media hora, costos importados de precio_por_hora*duración editables, slug autogenerado).
- [HECHO] Fase 2: precio_por_hora en sedes y árbitros. SQL: supabase/sql/03_precios_por_hora.sql.
- [HECHO] Fase 2: inscripción pública /inscribir/[slug] con RPC atómica public.inscribirse()
  (SELECT FOR UPDATE). SQL: supabase/sql/02_inscripcion_rpc.sql. Verificado sin sobreventa
  con 6 inscripciones concurrentes. login/registro respetan ?next=.
- [HECHO] Fase 2: subida de comprobante a Storage. Bucket privado `comprobantes` (creado),
  form en /inscribir/[slug] que sube el archivo bajo {uid}/ y registra el pago (en_revision).
  SQL de políticas: supabase/sql/04_storage_comprobantes.sql.
- [HECHO] Fase 2: panel de aprobación de pagos en /admin/pagos (ver comprobante por URL
  firmada, aprobar/rechazar). RPCs atómicas aprobar_pago()/rechazar_pago() con es_admin().
  SQL: supabase/sql/05_aprobacion_pagos.sql. Verificado: aprobar confirma la inscripción;
  rechazar deja pendiente; participante no puede aprobar.

## Roadmap (plan de fases)
- **Fase 1 (COMPLETA):** Auth + roles + RLS + CRUD de `sedes` y `arbitros` (panel /admin).
- **Fase 2 (COMPLETA):** Crear eventos (cálculo de costo + slug), página pública de inscripción
  con RPC atómica, subida de comprobante a Storage, panel de aprobación de pagos del admin.
- **Fase 3 (EN CURSO):** Lógica de cupos atómica implementada en SQL.
  - aprobar_pago() ahora aplica "el que paga primero gana": un lista_espera que paga
    desplaza a un pendiente con comprobante más nuevo (o sin pagar) -> 'liberado'.
  - expirar_y_promover() (pg_cron cada 5 min): expira pendientes vencidos sin pago y
    promueve lista_espera a pendiente con nueva ventana.
  - Notificaciones in-app (tabla `notificaciones`): promovido/liberado/expirado/confirmado;
    se ven en /dashboard. Base para email/WhatsApp (delivery externo = pendiente).
  - La lista de espera ya puede pagar (compite por cupo). SQL: 06_notificaciones, 07_logica_cupos.
- **Fase 4 (EN CURSO):** Módulo financiero en /admin/finanzas (sin SQL nuevo; agrega en la app
  con RLS de admin). Consolidado con filtro por rango de fechas (ingresos/egresos/ganancia/morosos)
  y detalle por evento /admin/finanzas/[id] con lista de inscritos y morosos.
  Ingresos = pagos aprobados; egresos = costo_sede + costo_arbitraje; moroso = pendiente sin pago.

## Convenciones
- Código y UI en español. Variables/tablas en español (ya establecido en el esquema).
- Usar Tailwind. Color de acento: naranja (orange-600), tema básquet.
- Para mutaciones del lado servidor preferir Server Actions o Route Handlers.
- Nunca exponer SUPABASE_SERVICE_ROLE_KEY al navegador.