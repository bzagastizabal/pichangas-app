import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Fija la raíz del proyecto. Existe otro package-lock.json en el home del
    // usuario y, por defecto, Turbopack elegía esa carpeta como raíz del
    // workspace (de ahí el aviso "inferred your workspace root").
    root: __dirname,
  },
};

export default nextConfig;
