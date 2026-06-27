import React, { useState, useEffect } from 'react';
import { ShieldCheck, Lock, Database, Eye } from 'lucide-react';

interface TermsConsentProps {
  forceShow?: boolean;
  onClose?: () => void;
}

export const TermsConsent: React.FC<TermsConsentProps> = ({ forceShow = false, onClose }) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (forceShow) {
      setIsOpen(true);
      return;
    }
    const accepted = localStorage.getItem('chigari_terms_accepted');
    if (!accepted) {
      setIsOpen(true);
    }
  }, [forceShow]);

  const handleAccept = () => {
    localStorage.setItem('chigari_terms_accepted', 'true');
    setIsOpen(false);
    if (onClose) onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Banner header */}
        <div className="bg-indigo-950 p-8 text-white relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-1/3 -translate-y-1/3 opacity-10">
            <ShieldCheck className="w-64 h-64" />
          </div>
          <div className="relative z-10 flex items-center space-x-4">
            <div className="p-3 bg-white/10 rounded-2xl">
              <ShieldCheck className="w-8 h-8 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-lg font-black uppercase tracking-wider">Transit Security Protocol</h3>
              <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest mt-0.5">Terms of Service & Privacy Notice</p>
            </div>
          </div>
        </div>

        {/* Content body */}
        <div className="p-8 space-y-6 max-h-[50vh] overflow-y-auto no-scrollbar">
          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            Welcome to the Hubballi-Dharwad Premium Bus Management Terminal ({window.location.hostname}). Before utilizing our real-time logistics matrix, please review our operational data protocols:
          </p>

          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600 mt-0.5 shrink-0">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-[10px] font-black uppercase text-slate-900 tracking-wider">Data We Collect</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed font-medium mt-1">
                  We securely synchronize your authenticated Google profile info (Gmail address, display name, and avatar), transit station searches, chosen seating reservations, and security logs.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600 mt-0.5 shrink-0">
                <Eye className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-[10px] font-black uppercase text-slate-900 tracking-wider">Why It is Collected</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed font-medium mt-1">
                  This data facilitates booking verification, passenger dashboard telemetry, real-time signal coordinate dispatching, and system-wide security auditing.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600 mt-0.5 shrink-0">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-[10px] font-black uppercase text-slate-900 tracking-wider">Security & Zero-Trust Storage</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed font-medium mt-1">
                  Your records are safeguarded via Firestore Attribute-Based Access Control (ABAC). Activity and system logs are strictly partitioned and visible only to authorized Red Administrators.
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-[10px] font-bold text-slate-500 leading-relaxed uppercase tracking-wide">
            Note: We request permission to store your local preference and session parameters. Once granted, you will not be prompted again.
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
            Chigari Protocol v1.4
          </div>
          <div className="flex space-x-3">
            {forceShow && (
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-3 border border-slate-200 hover:bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
              >
                Close
              </button>
            )}
            <button
              type="button"
              onClick={handleAccept}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-100 active:scale-[0.98]"
            >
              Agree & Accept Protocols
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
