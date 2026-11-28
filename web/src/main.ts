import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { installElementPlus } from './element-plus'
import './styles.css'
import './styles/platform-workspace.css'
import App from './App.vue'
import router from './router'
import { initLiquidGlass } from './lib/liquidGlass'

initLiquidGlass()
const app = createApp(App)
app.use(createPinia()).use(router)
installElementPlus(app)
app.mount('#app')
