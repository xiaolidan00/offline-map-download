import {createWebHashHistory, createRouter} from 'vue-router';

const routes = [{path: '/', component: () => import('./XYZGrid/XYZGrid.vue')}];

export const router = createRouter({
  history: createWebHashHistory(),
  routes
});
