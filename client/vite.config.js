import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  root: '.',
  build: {
    outDir: path.resolve(__dirname, '../static/dist'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Satıcı kodunu uygulama kodundan ayır. İki fayda:
        //   1. Tek 800 KB'lık parça yerine ayrı parçalar — hiçbiri 500 KB
        //      uyarı eşiğini geçmiyor.
        //   2. Önbellek isabeti: uygulama kodu her dağıtımda değişir, satıcı
        //      (React, socket.io) neredeyse hiç değişmez. Ayrı parça, kullanıcı
        //      her sürümde React'i yeniden indirmez — yalnızca değişen parçayı.
        // socket.io kendi parçası: gerçek zamanlı katman en büyük tek bağımlılık
        // ve sohbet/bildirim dışında gerekmiyor.
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('socket.io') || id.includes('engine.io')) return 'realtime';
          if (id.includes('/react') || id.includes('/scheduler')) return 'react-vendor';
          return 'vendor';
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:5000',
      '/static': 'http://localhost:5000',
      '/socket.io': { target: 'http://localhost:5000', ws: true },
    },
  },
});
