import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export function resolveSupabaseEnv(env: Record<string, string | undefined> = process.env) {
  const a = env.VITE_TICKETING_SUPABASE_URL || '';
  const b = env.VITE_TICKETING_SUPABASE_ANON_KEY || '';
  const aIsUrl = a.startsWith('http://') || a.startsWith('https://');
  const bIsUrl = b.startsWith('http://') || b.startsWith('https://');
  if (!aIsUrl && bIsUrl) {
    return { url: b, anonKey: a };
  }
  return { url: a, anonKey: b };
}

export default defineConfig(({ mode }) => {
  const env = {
    ...loadEnv(mode, process.cwd(), ''),
    ...process.env,
  };
  const { url: supabaseUrl, anonKey: supabaseAnonKey } = resolveSupabaseEnv(env);

  return {
  server: {
    host: "0.0.0.0",
    port: 5000,
    allowedHosts: true,
  },
  define: {
    'import.meta.env.VITE_TICKETING_SUPABASE_URL': JSON.stringify(supabaseUrl),
    'import.meta.env.VITE_TICKETING_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey),
  },
  optimizeDeps: {
    include: ['recharts'],
  },
  build: {
    chunkSizeWarningLimit: 5000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('@splinetool') || id.includes('three')) return 'vendor-3d';
          if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
          if (id.includes('@radix-ui') || id.includes('cmdk')) return 'vendor-ui';
          if (id.includes('@supabase')) return 'vendor-supabase';
          if (id.includes('react') || id.includes('scheduler')) return 'vendor-react';
          return undefined;
        },
      },
    },
  },
  plugins: [
    react()
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  };
});
