// Nombre del club, para mostrar bajo el logo en cabeceras de páginas públicas.
// Mantiene tipografía y espaciado consistentes entre /login, /registro, /ayuda,
// /dashboard, /inscribir y /pagar.

export function MarcaClub({
  align = 'center',
  size = 'md',
}: {
  align?: 'center' | 'left';
  size?: 'sm' | 'md';
}) {
  const tx = size === 'sm' ? 'text-[11px]' : 'text-xs';
  return (
    <div className={`${tx} text-tenue ${align === 'center' ? 'text-center' : ''}`}>
      <p className="font-semibold text-texto leading-tight">CMT BasketBall Club</p>
      <p className="leading-tight">Clorinda Matto de Turner</p>
    </div>
  );
}
