import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import AppRoutes from './app/AppRoutes'
import './app/global.scss'
import { setupStore } from './shared/store'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <Provider store={setupStore()}>
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  </Provider>
)
