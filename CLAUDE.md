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
- **Fase 2 (COMPLETA):** Eventos (cálculo de costo + slug), página pública de inscripción con
  RPC atómica `inscribirse()` (SELECT FOR UPDATE), subida de comprobante a Storage (`comprobantes`)
  y panel de aprobación de pagos del admin. SQL: 02, 04, 05.
- **Fase 3 (COMPLETA):** Lógica de cupos atómica.
  - `aprobar_pago()` aplica "el que paga primero gana": un lista_espera que paga desplaza a un
    pendiente con comprobante más nuevo (o sin pagar) → 'liberado'.
  - `expirar_y_promover()` (pg_cron cada 5 min): expira pendientes vencidos sin pago y promueve
    lista_espera a pendiente con nueva ventana.
  - Notificaciones in-app (tabla `notificaciones`): promovido/liberado/expirado/confirmado.
  - La lista de espera puede pagar (compite por cupo). SQL: 06, 07.
  - **SQL 26 — modo_cupos por evento**: `inmediato` (clásico, default) o `tras_limite`. En
    `tras_limite` el `aprobar_pago` antes de la fecha límite aprueba el pago pero no desplaza;
    después del límite solo desplaza morosos (pendientes sin pago aprobado). El
    `expirar_y_promover` mejora para promover un lista_espera con pago aprobado directo a
    'confirmado'. Selector en `EventoForm` con radios + tooltip.
- **Fase 4 (COMPLETA):** Módulo financiero `/admin/finanzas`. Consolidado con filtro por rango
  de fechas (ingresos/egresos/ganancia/morosos) y detalle por evento `/admin/finanzas/[id]`
  con lista de inscritos y morosos. Ingresos = pagos aprobados; egresos base = costo_sede +
  costo_arbitraje; moroso = pendiente sin pago tras `eventoYaTermino`.
- **Fase 5 (COMPLETA):** Gestión avanzada de usuarios y branding.
  - Admin crea jugadores (`/admin/jugadores`) con email sintético `{dni}@jugador.cmt` cuando no
    tienen correo. Login por DNI (resuelve correo en server action `emailPorDni`). Reiniciar
    contraseña al DNI por defecto. Edición/baja de jugador con preservación de contraseña en
    update. Categorías (LIBRE/M40/Damas/etc.) asignables al evento y al perfil (`perfil_categorias`).
  - Cambiar contraseña en `/cuenta/clave`. Próximas pichangas en /dashboard con filtro por
    categoría. Notificaciones in-app.
  - **Branding CMT BasketBall Club — Clorinda Matto de Turner**: metadata con OG image
    `/og-image.jpg`, fuente Geist, AdminShell con sidebar (Operación / Finanzas / Configuración),
    `<MarcaClub/>` bajo cada logo, `<BannerMarchaBlanca/>`, tema oscuro permanente, BotonAyuda
    flotante con ContactosStaff. Tabla `staff` con `es_default` + contacto público vs logueado
    (`/api/staff` con RLS). `publicaciones` con bucket público (compresión cliente a WebP).
  - Links de pago expirables via JWT-style HMAC (`lib/token-pago.ts`) — no se persiste en BD.
  - Email transaccional con Resend (`lib/email.ts`, plantilla `correoHtml` + Google Calendar).
  - Recordatorios por hora con pg_cron + pg_net hitting `/api/recordatorios?horas=N`.
- **Fase 6 (COMPLETA):** Tarifa de árbitro por tramos + multi-árbitro + UX de eventos.
  - 1 h y 2 h con tarifa FIJA (`tarifa_1h`/`tarifa_2h`); 3 h o más se cobra POR HORA =
    `precio_por_hora × duración` (40 → 3 h=120, 4 h=160). `tarifa_3h`/`tarifa_mas` de SQL 18
    quedaron obsoletas y ya no se usan. `costoArbitroTramo()` en lib/types.
  - VARIOS árbitros por evento (tabla puente `evento_arbitros`); `costo_arbitraje` = suma de
    `costoArbitroTramo()` de los elegidos. SQL: 18.
  - `costo_por_participante` se redondea HACIA ARRIBA a soles enteros (Math.ceil); el excedente
    suma a la ganancia. El form muestra desglose egresos / recaudación / ganancia.
  - Un evento ya realizado (`eventoYaTermino`) NO se edita (barrera en server action + redirect
    en /editar + UI "Realizado solo lectura"); se COPIA con `/admin/eventos/nueva?desde=<id>`
    (clona config y árbitros, sin participantes ni fechas).
- **Fase 7 (COMPLETA):** Módulo de **movimientos** financieros (donaciones, premios, aportes,
  saldos, compras, gastos, pagos, reembolsos). Cada movimiento exige sustento (archivo en
  bucket privado `sustentos`) y aprobación de admin. Estados pendiente/aprobado/rechazado;
  solo los aprobados cuentan. RPCs `aprobar_movimiento()` / `rechazar_movimiento()`. SQL: 19.
  `evento_id` es opcional: INDEPENDIENTE (donación general, gasto de la org) o vinculado al
  evento. `/admin/finanzas/[id]` los suma al balance del evento (cuotas + extras vs sede +
  arbitraje + extras); en el global, los vinculados pertenecen a su evento y los SIN evento
  aparecen como "Movimientos independientes" (sin doble conteo).
- **Fase 8 (COMPLETA):** Recomendaciones del piloto. SQL 20: `fecha_nacimiento` + `nacionalidad`
  en perfiles, `edad_min`/`edad_max` en categorias, `foto_url` en staff (bucket público
  `staff_fotos`).
  - `/registro`, alta admin y edición admin capturan los nuevos campos. Lista de jugadores con
    contador, ordenamiento por columna (nombre/edad/dni/nacionalidad) y exportación CSV
    (`/admin/jugadores/exportar` con BOM UTF-8). Categorías sugeridas por rango de edad
    (`categoriaSugeridaPorEdad()`).
  - Staff con foto opcional (ContactosStaff la muestra como avatar).
  - `<CumpleanosDelMes/>` en /dashboard. `/login` con CTA "Regístrate" + link a /ayuda.
  - **OG image** global con insignia CMT 1200×630. `generateMetadata` en /inscribir.
  - **Carga masiva por CSV** (`/admin/jugadores/importar`): parser propio (`lib/csv.ts`), upsert
    por DNI (existe → UPDATE, no toca password; no existe → crea con password = DNI), plantilla
    descargable, dry-run, tabla de errores. Soporta `;` o `,`; fechas ISO o DD/MM/YYYY.
  - **NacionalidadInput** (`lib/nacionalidad.ts` + `components/NacionalidadInput.tsx`) reemplaza
    el input libre por select 🇵🇪 Perú / 🇻🇪 Venezuela / 🇨🇴 Colombia / 🌎 Otro (con campo libre).
    Normaliza datos viejos (`Peru` → `Peruana`). Usado en registro, alta y edición. El CSV
    import también normaliza al cargar.
- **Fase 10 (EN CURSO):** Módulo de **Torneos** — control de participación del club en
  torneos externos. SQL 23: `torneos`, `torneo_jugadores` (roster), `torneo_partidos`,
  `partido_jugadores` (asistencia jugó/no jugó). `movimientos` gana columnas `torneo_id` y
  `partido_id` para vincular gastos de inscripción, gastos por partido y aportes — el balance
  se calcula sumando movimientos aprobados vinculados al torneo o a sus partidos.
  - **Categoría por edad — nueva regla**: `categoriaDelJugador()` (en lib/types) elige la
    categoría de RANGO MÁS CHICO entre las que cubren la edad (ej. edad 41 con {17-55} y
    {38-55} → gana 38-55). Reemplaza la "sugerencia" anterior. `categoriaSugeridaPorEdad`
    queda como alias retro-compatible.
  - `/admin/torneos`: lista con estado + posición final + categoría.
  - `/admin/torneos/[id]`: hub con info, roster (chips), tabla de partidos con récord W-L
    calculado, balance financiero del torneo y asistencia acumulada por jugador.
  - `/admin/torneos/[id]/roster`: picker con dos secciones — "Coinciden con la categoría
    del torneo" (destacada en naranja) y "Otros".
  - `/admin/torneos/[id]/partidos/[pid]`: detalle del partido con asistencia (checkbox por
    jugador del roster), edición, eliminación, y atajo para registrar gastos como movimiento
    pre-vinculado (`?partido=<pid>&torneo=<tid>`).
  - MovimientoForm acepta `torneoInicial`/`partidoInicial`; la página /admin/movimientos/nuevo
    lee `?torneo` y `?partido` y trae solo los partidos del torneo seleccionado.
- **Fase 9 (EN CURSO):** Utilitario **Marcador** de baloncesto independiente (no se asocia a
  eventos).
  - SQL 21: tabla `marcadores` con tiempo (`reloj_inicio` + `reloj_restante_ms` = SSOT que evita
    drift) y shot clock; RLS público de lectura por slug, admin escribe; tabla en la publicación
    `supabase_realtime`.
  - SQL 22: flags opcionales `tiene_reloj_periodo` y `tiene_shot_clock` (modo "solo contar
    puntos"). Form de alta con checkboxes; el visor y el control adaptan layout (grid 1, 2 o 3
    columnas) y ocultan controles que no aplican. Fallback `?? true` para marcadores legacy.
  - `/admin/marcadores`: lista con expiración + prórroga + eliminación + copiar links.
  - `/admin/marcadores/[id]/control`: panel premium del operador (botones touch, fuente
    Orbitron, identidad CMT, play/pause circular).
  - `/marcador/[slug]`: visor broadcast a pantalla completa (Orbitron, insignia watermark
    1500×1500, gradiente, glow naranja/sky por equipo, flash al cambiar puntaje, último minuto
    rojo pulsante, shot < 5 s alerta, BONUS pulsante, double-click → fullscreen). Reloj se
    calcula con `Date.now() - reloj_inicio` (sin drift).
  - **OG image DINÁMICO** por marcador (`opengraph-image.tsx` con `next/og` + `ImageResponse`):
    WhatsApp ve `🏀 LOCAL 47 – 52 VISITANTE · Marcador en vivo · Q3` con la card "MARCADOR EN
    VIVO" en rojo, no la card genérica del club.
  - BotonAyuda se oculta en `/marcador/*` para no contaminar la proyección.
  - Pendiente: integraciones de proyección al TV (Wake Lock para evitar sleep, QR del visor en
    el control, modo overlay transparente para OBS, manifest PWA para Android TV).

## Convenciones
- Código y UI en español. Variables/tablas en español (ya establecido en el esquema).
- Usar Tailwind. Color de acento: naranja (orange-600), tema básquet.
- Para mutaciones del lado servidor preferir Server Actions o Route Handlers.
- Nunca exponer SUPABASE_SERVICE_ROLE_KEY al navegador.