import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router'
import './index.css'
import { AdminPage } from './pages/admin/AdminPage.tsx'
import { ExplorerPage } from './pages/ExplorerPage.tsx'
import { HomePage } from './pages/HomePage.tsx'
import { ScannerPage } from './pages/ScannerPage.tsx'
import { TicketsPage } from './pages/TicketsPage.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/event/:eventId" element={<ExplorerPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/tickets" element={<TicketsPage />} />
        <Route path="/scan" element={<ScannerPage />} />
        <Route path="*" element={<HomePage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
