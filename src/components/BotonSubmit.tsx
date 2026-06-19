// Botón submit que se deshabilita automáticamente mientras corre la acción.
// Evita doble-click que dispara el server action dos veces (causando p. ej.
// pagos duplicados). Debe usarse DENTRO de un <form action={...}>.
'use client';

import { useFormStatus } from 'react-dom';

export function BotonSubmit({
  children,
  pendiente,
  className = '',
}: {
  children: React.ReactNode;
  pendiente?: React.ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`${className} disabled:opacity-60 disabled:cursor-not-allowed`}
    >
      {pending ? (pendiente ?? '…') : children}
    </button>
  );
}
