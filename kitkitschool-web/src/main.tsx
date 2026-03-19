import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { CurriculumProvider } from './context/CurriculumContext'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <CurriculumProvider>
        <App />
      </CurriculumProvider>
    </BrowserRouter>
  </StrictMode>,
)
