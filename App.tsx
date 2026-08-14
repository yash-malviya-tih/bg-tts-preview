import React from 'react';
import DemoWidget from './components/DemoWidget';
import { LOGO_URL } from './constants';

function App() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center px-4 py-4 md:px-6 md:py-5 relative overflow-hidden bg-[color:rgb(var(--brand-bg))]">
      
      {/* Ambient Background Gradients (BharatGen Colors: Orange & Blue) */}
      <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-[color:rgb(var(--brand-orange)/0.18)] rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-[color:rgb(var(--brand-blue)/0.14)] rounded-full blur-[120px] pointer-events-none" />
      
      {/* Main Container */}
      <div className="w-full max-w-[1020px] lg:max-w-[1240px] 2xl:max-w-[1400px] flex flex-col gap-3 2xl:gap-4 z-10">
        
        {/* Minimal Header */}
        <div className="flex items-center gap-3 pl-1">
            <img src={LOGO_URL} className="h-6 w-6 2xl:h-7 2xl:w-7 object-contain" alt="Logo" />
            <div>
              <h1 className="text-lg md:text-xl 2xl:text-2xl font-bold text-[color:rgb(var(--brand-ink))] tracking-tight leading-tight">
                BharatGen <span className="text-transparent bg-clip-text bg-gradient-to-r from-[color:rgb(var(--brand-orange))] to-[color:rgb(var(--brand-blue))]">Sooktam 2</span>
              </h1>
              <p className="text-xs text-slate-500">
                Type text, pick or clone a voice, and hear it speak — in 22 Indian languages.
              </p>
            </div>
        </div>

        {/* The Component */}
        <div className="shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-white rounded-2xl overflow-hidden border border-white">
           <DemoWidget />
        </div>

      </div>

    </div>
  );
}

export default App;
