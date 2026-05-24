// src/proxy.ts
// Antes era middleware.ts. Next 16 deprecó el convenio "middleware" en favor de
// "proxy": mismo comportamiento, el archivo se llama proxy.ts y la función proxy().
// Va dentro de src/ (al mismo nivel que app). Refresca el token de Supabase en
// cada request para que la sesión no se pierda al navegar o refrescar la página.
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANTE: refresca la sesión. No quitar esta línea.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  // Corre en todas las rutas excepto archivos estáticos e imágenes.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
