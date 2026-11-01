import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// Em dev o Vite faz proxy de /api e /uploads para a API: mesma origem, então
// o cookie httpOnly do refresh (Path=/api/v1/auth) funciona sem CORS — igual
// ao nginx em produção.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env.VITE_API_PROXY_TARGET || "http://localhost:3000";

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    server: {
      port: 5173,
      proxy: {
        "/api": { target: apiTarget, changeOrigin: true },
        "/uploads": { target: apiTarget, changeOrigin: true },
      },
    },
    preview: { port: 4173 },
    build: {
      target: "es2022",
      sourcemap: true,
      rolldownOptions: {
        output: {
          // Bibliotecas grandes em pedaços próprios (cache longo entre deploys);
          // cada tela já vira um chunk pelo lazy() do router.
          codeSplitting: {
            groups: [
              // Utilitários pequenos usados por todos (inclusive pelo recharts):
              // ficam fora do grupo "charts" para o gráfico não vir na carga inicial.
              {
                name: "vendor",
                test: /node_modules[\\/](clsx|tailwind-merge|use-sync-external-store)[\\/]/,
                priority: 40,
              },
              {
                name: "react",
                test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/,
                priority: 30,
              },
              { name: "query", test: /node_modules[\\/]@tanstack[\\/]/, priority: 25 },
              // Zod valida as respostas da API desde o login: vai na carga inicial.
              { name: "zod", test: /node_modules[\\/]zod[\\/]/, priority: 20 },
              // Formulários só chegam com as telas que editam (o login também, sob demanda).
              {
                name: "forms",
                test: /node_modules[\\/](react-hook-form|@hookform)[\\/]/,
                priority: 20,
              },
              {
                name: "charts",
                test: /node_modules[\\/](recharts|d3-[^\\/]+|victory-vendor|es-toolkit|immer|reselect|redux|@reduxjs|react-redux|decimal\.js-light|eventemitter3)[\\/]/,
                priority: 20,
              },
            ],
          },
        },
      },
    },
  };
});
