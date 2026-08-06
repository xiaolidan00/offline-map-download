import {defineConfig} from 'vite';
import vue from '@vitejs/plugin-vue';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import {ElementPlusResolver} from 'unplugin-vue-components/resolvers';
// https://vite.dev/config/
export default defineConfig({
  base: process.env.NODE_ENV == 'development' ? '/' : '/mapxyz/',
  plugins: [
    vue(),
    AutoImport({
      imports: [
        {
          vue: [
            'ref',
            'useTemplateRef',
            'reactive',
            'onMounted',
            'onBeforeUnmoun',
            'onBeforeUnmount',
            'watch',
            'computed'
          ]
        },

        {
          'lodash-es': ['debounce', 'throttle']
        }
      ],
      dts: true
    }),
    AutoImport({resolvers: [ElementPlusResolver()]}),

    Components({
      resolvers: [ElementPlusResolver()]
    })
  ]
});
