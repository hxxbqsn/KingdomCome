export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('/node_modules/@supabase/')) return 'supabase';
        }
      }
    }
  }
};
