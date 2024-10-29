import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './styles/index.scss'
import { Provider } from 'react-redux'
import { setupStore } from './store/index.ts'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <Provider store={setupStore()}>
    <App />
  </Provider>
)
