import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
    base: process.env.NODE_ENV === 'production' ? '/projects/queue/demo/' : '/',
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                kiosco: resolve(__dirname, 'kiosco/index.html'),
                'kiosco-confirmacion': resolve(__dirname, 'kiosco/confirmacion/index.html'),
                'kiosco-ticket': resolve(__dirname, 'kiosco/ticket/index.html'),
                pantalla: resolve(__dirname, 'pantalla/index.html'),
                'operador-login': resolve(__dirname, 'operador/login/index.html'),
                operador: resolve(__dirname, 'operador/index.html'),
                'operador-triaje': resolve(__dirname, 'operador/triaje/index.html'),
                'admin-servicios': resolve(__dirname, 'admin/servicios/index.html'),
                'admin-puestos': resolve(__dirname, 'admin/puestos/index.html'),
                analitica: resolve(__dirname, 'analitica/index.html'),
                turno: resolve(__dirname, 'turno/index.html'),
            },
        },
    },
    server: {
        host: true,
        proxy: {
            '/api': {
                target: 'http://127.0.0.1:5150',
                changeOrigin: true,
                secure: false,
            },
        },
    },
})
