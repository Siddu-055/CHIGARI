import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Alert } from '../types';
import { Bell, Clock, ChevronRight, Info, AlertTriangle, AlertCircle, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { BRAND_NAME, BRAND_TAGLINE } from '../constants';
import { motion, AnimatePresence } from 'motion/react';

export const AlertsPage = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'alerts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAlerts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Alert)));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 pb-10">
        <div className="space-y-1">
          <h2 className="text-4xl font-black text-slate-900 tracking-tight uppercase leading-none">{BRAND_NAME}</h2>
          <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-[0.25em]">{BRAND_TAGLINE}</p>
        </div>
        <div className="flex items-center space-x-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl">
          <Bell className="w-4 h-4 text-indigo-600" />
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Network Alerts Center</span>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center uppercase tracking-[0.5em] font-black text-slate-200 text-xs animate-pulse">
          Synchronizing Protocol...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {alerts.map((alert) => (
            <motion.div 
              key={alert.id}
              whileHover={{ y: -4 }}
              onClick={() => setSelectedAlert(alert)}
              className={cn(
                "p-8 rounded-[2.5rem] border flex flex-col shadow-sm transition-all cursor-pointer group",
                alert.type === 'urgent' ? "bg-white border-red-100 hover:border-red-400" : 
                alert.type === 'warning' ? "bg-white border-amber-100 hover:border-amber-400" : 
                "bg-white border-slate-100 hover:border-indigo-400"
              )}
            >
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center space-x-4">
                  <div className={cn(
                    "p-3 rounded-2xl",
                    alert.type === 'urgent' ? "bg-red-50 text-red-500" : 
                    alert.type === 'warning' ? "bg-amber-50 text-amber-500" : 
                    "bg-indigo-50 text-indigo-500"
                  )}>
                    {alert.type === 'urgent' ? <AlertCircle className="w-6 h-6" /> : 
                     alert.type === 'warning' ? <AlertTriangle className="w-6 h-6" /> : 
                     <Info className="w-6 h-6" />}
                  </div>
                  <div>
                    <span className={cn(
                      "text-[9px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded",
                      alert.type === 'urgent' ? "bg-red-100/50 text-red-600" : 
                      alert.type === 'warning' ? "bg-amber-100/50 text-amber-600" : 
                      "bg-indigo-50 text-indigo-600"
                    )}>
                      {alert.type} Broadcast
                    </span>
                    <h3 className="text-xl font-bold text-slate-900 tracking-tighter mt-1 group-hover:text-indigo-600 transition-colors">
                      {alert.title}
                    </h3>
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 text-slate-300 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                  <ChevronRight className="w-5 h-5" />
                </div>
              </div>

              <p className="text-sm font-medium text-slate-500 line-clamp-2 mb-8 leading-relaxed">
                {alert.message}
              </p>

              <div className="mt-auto pt-6 border-t border-slate-50 flex items-center justify-between text-[8px] font-black uppercase tracking-[0.2em] text-slate-300">
                <div className="flex items-center space-x-2">
                  <Clock className="w-3 h-3" />
                  <span>Issued: {new Date(alert.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
                <span className="text-indigo-400 group-hover:text-indigo-600 transition-colors">View Details</span>
              </div>
            </motion.div>
          ))}

          {alerts.length === 0 && (
            <div className="lg:col-span-2 py-24 text-center bg-slate-50 rounded-[3rem] border border-dashed border-slate-200">
              <Bell className="w-12 h-12 text-slate-200 mx-auto mb-4" />
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest italic">All systems reporting nominal - No active alerts</p>
            </div>
          )}
        </div>
      )}

      {/* Alert Details Modal */}
      <AnimatePresence>
        {selectedAlert && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedAlert(null)}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-2xl rounded-[3rem] overflow-hidden shadow-2xl"
            >
              <div className={cn(
                "p-10 flex items-center justify-between border-b",
                selectedAlert.type === 'urgent' ? "bg-red-50/50 border-red-100" : 
                selectedAlert.type === 'warning' ? "bg-amber-50/50 border-amber-100" : 
                "bg-indigo-50/50 border-indigo-100"
              )}>
                <div className="flex items-center space-x-4">
                  <div className={cn(
                    "p-3 rounded-2xl shadow-sm",
                    selectedAlert.type === 'urgent' ? "bg-white text-red-500" : 
                    selectedAlert.type === 'warning' ? "bg-white text-amber-500" : 
                    "bg-white text-indigo-500"
                  )}>
                    {selectedAlert.type === 'urgent' ? <AlertCircle className="w-8 h-8" /> : 
                     selectedAlert.type === 'warning' ? <AlertTriangle className="w-8 h-8" /> : 
                     <Info className="w-8 h-8" />}
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Network Broadcast Bulletin</span>
                    <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none mt-1">{selectedAlert.title}</h3>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedAlert(null)}
                  className="p-3 hover:bg-white rounded-full transition-all text-slate-300 hover:text-slate-900"
                >
                  <X className="w-8 h-8" />
                </button>
              </div>

              <div className="p-12">
                <div className="flex items-center space-x-3 mb-8">
                  <div className="px-3 py-1 bg-slate-100 rounded-lg text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center space-x-2">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(selectedAlert.createdAt).toLocaleString()}</span>
                  </div>
                  <div className={cn(
                    "px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest",
                    selectedAlert.type === 'urgent' ? "bg-red-100 text-red-600" : 
                    selectedAlert.type === 'warning' ? "bg-amber-100 text-amber-600" : 
                    "bg-indigo-100 text-indigo-600"
                  )}>
                    Type: {selectedAlert.type}
                  </div>
                </div>

                <div className="prose prose-slate max-w-none">
                  <p className="text-lg font-medium text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {selectedAlert.message}
                  </p>
                </div>

                <div className="mt-12 p-8 bg-slate-50 rounded-3xl border border-slate-100 flex items-center justify-between">
                   <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-indigo-600 font-black text-xs shadow-sm">HQ</div>
                      <div>
                         <p className="text-[10px] font-black text-slate-900 uppercase">Authorized By</p>
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Network Operations Center</p>
                      </div>
                   </div>
                   <button 
                    onClick={() => setSelectedAlert(null)}
                    className="px-8 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-lg shadow-slate-200"
                   >
                     Acknowledge Notice
                   </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
