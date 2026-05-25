// Helpers para enlaces de WhatsApp (wa.me).

// Normaliza un teléfono a dígitos con código de país (Perú = 51 si son 9 dígitos).
export function numeroWa(tel: string | null | undefined): string {
  const d = (tel ?? '').replace(/\D/g, '');
  if (!d) return '';
  return d.length === 9 ? '51' + d : d;
}

// Arma el enlace wa.me. Con número abre el chat de esa persona; sin número abre
// WhatsApp para elegir contacto. El mensaje va pre-cargado.
export function linkWa(tel: string | null | undefined, mensaje: string): string {
  const n = numeroWa(tel);
  const txt = encodeURIComponent(mensaje);
  return n ? `https://wa.me/${n}?text=${txt}` : `https://wa.me/?text=${txt}`;
}
