import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ClerkProvider } from '@clerk/clerk-react'
import { AuthProvider } from './contexts/AuthContext'
import App from './App.tsx'
import './index.css'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key")
}

// #region agent log
fetch('http://127.0.0.1:7735/ingest/e2ae643e-1184-40a1-9f61-75bc5e06ec80',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9ceeb1'},body:JSON.stringify({sessionId:'9ceeb1',runId:'vercel-preview-black-screen',hypothesisId:'V1',location:'main.tsx:14',message:'App boot',data:{origin:window.location.origin,hostname:window.location.hostname,isLiveKey:PUBLISHABLE_KEY.startsWith('pk_live_')},timestamp:Date.now()})}).catch(()=>{});
window.addEventListener('error', (event) => { fetch('http://127.0.0.1:7735/ingest/e2ae643e-1184-40a1-9f61-75bc5e06ec80',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9ceeb1'},body:JSON.stringify({sessionId:'9ceeb1',runId:'vercel-preview-black-screen',hypothesisId:'V2',location:'main.tsx:15',message:'window error',data:{message:event.message,filename:event.filename},timestamp:Date.now()})}).catch(()=>{}); });
window.addEventListener('unhandledrejection', (event) => { fetch('http://127.0.0.1:7735/ingest/e2ae643e-1184-40a1-9f61-75bc5e06ec80',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9ceeb1'},body:JSON.stringify({sessionId:'9ceeb1',runId:'vercel-preview-black-screen',hypothesisId:'V2',location:'main.tsx:16',message:'unhandled rejection',data:{reason:String(event.reason)},timestamp:Date.now()})}).catch(()=>{}); });
// #endregion

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ClerkProvider>
  </React.StrictMode>,
)
