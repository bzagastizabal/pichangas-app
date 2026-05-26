// Banner sutil que avisa que la app está en período de prueba (marcha blanca).
// Lo mostramos en las landings de usuario (dashboard, inscripción pública) para
// fijar expectativas: bugs posibles, feedback bienvenido.

export function BannerMarchaBlanca() {
  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs leading-snug text-amber-200">
      <p>
        <span className="font-semibold">🚦 Marcha blanca</span> — estamos
        probando la app antes del lanzamiento oficial. Si encuentras algo raro,
        cuéntanos por la sección de ayuda.
      </p>
    </div>
  );
}
