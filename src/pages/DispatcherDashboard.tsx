/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Bus, Route, Stop } from '../types';
import { useAuth } from '../lib/AuthContext';
import { logActivity } from '../lib/activityLogger';
import { BusMap } from '../components/BusMap';
import { Radio, MapPin, Navigation, Signal, RefreshCw, Activity, Layers, Filter } from 'lucide-react';
import { cn } from '../lib/utils';

export const DispatcherDashboard = () => {
  const { profile } = useAuth();
  const [buses, setBuses] = useState<Bus[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [stops, setStops] = useState<Stop[]>([]);
  const [selectedBusId, setSelectedBusId] = useState<string | null>(null);

  useEffect(() => {
    onSnapshot(collection(db, 'buses'), snapshot => setBuses(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Bus))));
    onSnapshot(collection(db, 'routes'), snapshot => setRoutes(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Route))));
    onSnapshot(collection(db, 'stops'), snapshot => setStops(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Stop))));
  }, []);

  const assignRoute = async (busId: string, routeId: string) => {
    try {
      const targetBus = buses.find(b => b.id === busId);
      const targetRoute = routes.find(r => r.id === routeId);
      await updateDoc(doc(db, 'buses', busId), { currentRouteId: routeId, updatedAt: new Date().toISOString() });
      await logActivity(
        profile,
        'ASSIGN_ROUTE',
        `Assigned Bus '${targetBus?.busNumber || busId}' to Route '${targetRoute?.name || routeId}'`
      );
    } catch (e) { console.error(e); }
  };

  const selectedBus = buses.find(b => b.id === selectedBusId);
  const activeBuses = buses.filter(b => b.status === 'active');

  return (
    <div className="h-full flex flex-col space-y-8 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <div className="h-0.5 w-8 bg-indigo-600"></div>
            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.4em]">Operations Center</span>
          </div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight uppercase leading-none">Fleet <span className="text-indigo-600">Command</span></h2>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.25em]">Live Vector Projection & Unit Deployment</p>
        </div>
        
        <div className="flex items-center space-x-3">
           <div className="bg-white px-5 py-3 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-5 ring-1 ring-slate-100">
              <div className="text-right">
                <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest leading-none mb-1">Signal Status</p>
                <p className="text-xs font-mono font-bold text-emerald-600 tracking-tighter uppercase">{activeBuses.length} Units Active</p>
              </div>
              <div className="w-px h-8 bg-slate-100" />
              <button 
                onClick={() => window.location.reload()}
                className="p-2 bg-slate-50 hover:bg-indigo-50 rounded-xl transition-all text-slate-400 hover:text-indigo-600 group active:scale-95"
              >
                 <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
              </button>
           </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 min-h-[600px] overflow-hidden">
        {/* Sidebar Controls */}
        <div className="lg:col-span-3 space-y-6 flex flex-col overflow-hidden">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden flex-1 ring-1 ring-slate-100">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tactical Inventory</h3>
              <div className="flex space-x-1.5 font-mono text-[9px] text-indigo-400">
                 <span>NODES:</span>
                 <span>{buses.length}</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar bg-slate-50/30">
              {buses.map(bus => {
                const route = routes.find(r => r.id === bus.currentRouteId);
                const isSelected = selectedBusId === bus.id;
                return (
                  <button
                    key={bus.id}
                    onClick={() => setSelectedBusId(bus.id)}
                    className={cn(
                      "w-full text-left p-4 rounded-2xl transition-all border group relative overflow-hidden",
                      isSelected 
                        ? "bg-white border-indigo-400 shadow-xl shadow-indigo-100 ring-2 ring-indigo-500/5" 
                        : "bg-white border-transparent hover:border-slate-200 hover:bg-slate-50 shadow-sm"
                    )}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className={cn("font-mono font-black text-sm tracking-tighter italic", isSelected ? "text-indigo-600" : "text-slate-800")}>#{bus.busNumber}</span>
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        bus.status === 'active' ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.7)] animate-pulse" : "bg-slate-300"
                      )} />
                    </div>
                    <div className="flex items-center space-x-2 text-[9px] font-black uppercase tracking-widest text-slate-400 group-hover:text-slate-600 italic">
                      <Navigation className="w-3.5 h-3.5 text-indigo-400 opacity-60" />
                      <span className="truncate">{route?.name || 'STANDBY'}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedBus && (
            <div className="bg-indigo-950 rounded-3xl p-6 text-white shadow-2xl space-y-6 animate-in slide-in-from-bottom-5 duration-500 shrink-0 border border-white/5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-[0.05] pointer-events-none grayscale group-hover:rotate-12 transition-transform">
                 <Radio className="w-20 h-20" />
              </div>
              <div className="flex justify-between items-center border-b border-white/10 pb-4 relative z-10">
                <div>
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] leading-none mb-1">Vector Control</p>
                  <h3 className="font-black text-lg tracking-tight italic uppercase">Target: unit-{selectedBus.busNumber}</h3>
                </div>
                <button onClick={() => setSelectedBusId(null)} className="text-white/40 hover:text-white transition-colors text-[9px] font-black py-1 px-2 border border-white/10 rounded uppercase">Reset</button>
              </div>
              <div className="space-y-4 relative z-10">
                 <p className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.3em]">Deploy Instruction</p>
                 <div className="grid grid-cols-2 gap-2.5 max-h-[160px] overflow-y-auto no-scrollbar pt-1">
                   {routes.map(r => (
                     <button
                       key={r.id}
                       onClick={() => assignRoute(selectedBus.id, r.id)}
                       className={cn(
                         "px-3 py-3 rounded-xl text-[10px] font-black transition-all border border-transparent uppercase tracking-widest truncate text-center",
                         selectedBus.currentRouteId === r.id 
                           ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/40 ring-1 ring-white/20" 
                           : "bg-white/5 text-indigo-300 hover:bg-white/10 hover:text-white border-white/10"
                       )}
                     >
                       {r.name}
                     </button>
                   ))}
                 </div>
              </div>
            </div>
          )}
        </div>

        {/* Map Area */}
        <div className="lg:col-span-9 space-y-4 flex flex-col">
          <BusMap buses={buses} routes={routes} stops={stops} selectedBusId={selectedBusId} />
          
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2">
                 <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                 <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Inoperative</span>
              </div>
              <div className="flex items-center space-x-2">
                 <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                 <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Mission Critical</span>
              </div>
              <div className="flex items-center space-x-2">
                 <div className="w-2 h-2 border-2 border-slate-400 rounded-full" />
                 <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Transit Nodes</span>
              </div>
            </div>

            <div className="flex items-center space-x-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest italic">
               <Layers className="w-3 h-3" />
               <span>Layer-1 Projection</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
