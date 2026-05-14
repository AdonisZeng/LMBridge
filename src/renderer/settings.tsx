import React from 'react'
import ReactDOM from 'react-dom/client'
import { SettingsWindow } from '@/components/settings/SettingsWindow'
import './index.css'

ReactDOM.createRoot(document.getElementById('settings-root')!).render(
  <React.StrictMode>
    <SettingsWindow />
  </React.StrictMode>
)
