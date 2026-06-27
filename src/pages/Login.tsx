/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useAuth } from '../lib/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Zap, Globe, ArrowRight, Activity, ShieldCheck } from 'lucide-react';
import { BRAND_LOGO_URL, BRAND_NAME, BRAND_TAGLINE } from '../constants';

export const Login = () => {
  const { signIn, user, isSigningIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from?.pathname || '/';
  const isInIframe = window.self !== window.top;

  React.useEffect(() => {
    if (user) {
      navigate(from, { replace: true });
    }
  }, [user, navigate, from]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-slate-100 ring-1 ring-slate-200">
        {/* Left Side: Branding */}
        <div className="bg-indigo-950 p-12 text-white flex flex-col justify-between relative overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-600/5 rounded-full blur-[80px] translate-y-1/3 -translate-x-1/4" />
          
          <div className="relative z-10">
            <div className="flex items-center space-x-4 mb-12">
               <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-500/20 p-2 transform -rotate-3 hover:rotate-0 transition-transform duration-500">
                  <img src={BRAND_LOGO_URL} alt="Chigari Logo" referrerPolicy="no-referrer" className="w-full h-full object-contain" />
               </div>
               <div>
                  <span className="text-2xl font-black tracking-tighter uppercase block">{BRAND_NAME}</span>
                  <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-indigo-400">{BRAND_TAGLINE}</span>
               </div>
            </div>
            
            <div className="space-y-6">
              <h1 className="text-5xl font-black tracking-tighter leading-none">
                THE FUTURE OF <br />
                <span className="text-indigo-500 italic">URBAN MOBILITY</span>
              </h1>
              <p className="text-indigo-200/60 max-w-xs text-sm font-medium leading-relaxed">
                Connect with the pulse of the city. Real-time fleet intelligence for Hubballi-Dharwad's premium transit network.
              </p>
            </div>
          </div>

          <div className="relative z-10 pt-12">
             <div className="flex items-center space-x-4 mb-4">
                <div className="bg-indigo-900/50 p-2 rounded-lg"><ShieldCheck className="w-4 h-4 text-indigo-400" /></div>
                <div>
                   <p className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Identity Verified</p>
                   <p className="text-[9px] text-indigo-200/40 uppercase font-medium">Enterprise SSO Integration</p>
                </div>
             </div>
          </div>
        </div>

        {/* Right Side: Action */}
        <div className="p-12 lg:p-24 flex flex-col justify-center items-center text-center space-y-12">
           <div className="space-y-4">
              <div className="inline-flex items-center space-x-2 px-3 py-1 bg-indigo-50 rounded-full border border-indigo-100">
                 <Zap className="w-3 h-3 text-indigo-600 fill-indigo-600" />
                 <span className="text-[9px] font-black uppercase tracking-widest text-indigo-700">Strategic Infrastructure</span>
              </div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">System Authorization</h2>
              <p className="text-sm text-slate-500 max-w-xs mx-auto font-medium">Please authenticate using your organizational credentials to access the command terminal.</p>
           </div>

           <button
             onClick={() => signIn()}
             disabled={isSigningIn}
             className="group relative flex items-center justify-center w-full max-w-sm py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl hover:bg-indigo-600 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-wait"
           >
             <span className="relative z-10 flex items-center">
                {isSigningIn ? (
                  <>
                    <Activity className="w-4 h-4 mr-2 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  <>
                    Sign In with Google
                    <ArrowRight className="w-4 h-4 ml-3 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
             </span>
           </button>

           {isInIframe && (
             <div className="bg-amber-50 border border-amber-100 rounded-2xl p-6 max-w-sm space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 shadow-sm">
               <div className="flex items-start space-x-3 text-left">
                 <div className="bg-amber-100 p-2 rounded-xl mt-0.5 shadow-inner">
                   <Globe className="w-4 h-4 text-amber-600" />
                 </div>
                 <div>
                   <h4 className="text-[11px] font-black uppercase tracking-[0.1em] text-amber-900">Sign-In Constraint Noticed</h4>
                   <p className="text-[10px] font-medium text-amber-700/90 leading-relaxed mt-1.5">
                     Your browser may be blocking the authentication popup within this preview frame. For the best experience, use the dedicated portal link below.
                   </p>
                 </div>
               </div>
               <button 
                 onClick={() => window.open(window.location.href, '_blank')}
                 className="w-full py-3 bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-700 transition-all shadow-md active:scale-[0.98]"
               >
                 Open Portal in New Tab
               </button>
             </div>
           )}

           <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest text-center px-4 leading-relaxed max-w-xs">
             <p>Security Handshake: You will be prompted to select an account. Please ensure popups are enabled for this domain.</p>
           </div>

           <div className="pt-8 border-t border-slate-100 w-full max-w-xs flex justify-between">
              <div className="flex flex-col items-center">
                 <Globe className="w-4 h-4 text-slate-300 mb-1" />
                 <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Global Hub</span>
              </div>
              <div className="flex flex-col items-center">
                 <Activity className="w-4 h-4 text-slate-300 mb-1" />
                 <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">99.9% Uptime</span>
              </div>
              <div className="flex flex-col items-center">
                 <ShieldCheck className="w-4 h-4 text-slate-300 mb-1" />
                 <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">RSA Secure</span>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};
