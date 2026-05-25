// Tooltip de ayuda (ícono "i") en CSS puro (sin JS). Aparece al pasar el cursor
// o enfocar con teclado.
export function Pista({ texto }: { texto: string }) {
  return (
    <span className="group relative inline-block align-middle">
      <span
        tabIndex={0}
        className="ml-1 inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-borde text-[10px] leading-none text-tenue"
      >
        i
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-30 mt-1 hidden w-52 -translate-x-1/2 rounded border border-borde bg-tarjeta p-2 text-xs font-normal text-texto shadow-lg group-hover:block group-focus-within:block"
      >
        {texto}
      </span>
    </span>
  );
}
