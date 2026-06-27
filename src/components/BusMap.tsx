/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { APIProvider, Map, AdvancedMarker } from '@vis.gl/react-google-maps';
import { Bus as BusIcon, MapPin, ShieldAlert } from 'lucide-react';
import { Bus, Route, Stop } from '../types';
import { cn } from '../lib/utils';

const API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';
const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

interface BusMapProps {
  buses: Bus[];
  routes: Route[];
  stops: Stop[];
  selectedBusId?: string | null;
}

export const BusMap: React.FC<BusMapProps> = ({ buses, routes, stops, selectedBusId }) => {
  if (!hasValidKey) {
    return (
      <div className="bg-slate-100 rounded-[2.5rem] h-[600px] flex items-center justify-center border border-slate-200 shadow-inner relative overflow-hidden group">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-50/50 via-transparent to-transparent opacity-50" />
        <div className="text-center p-12 max-w-md relative z-10">
           <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl ring-1 ring-slate-100 group-hover:scale-110 transition-transform duration-700">
              <ShieldAlert className="w-10 h-10 text-indigo-500" />
           </div>
           <h3 className="text-2xl font-black text-slate-900 mb-4 uppercase tracking-tight leading-tight">Spatial Protocols <br /><span className="text-indigo-600 italic">Offline</span></h3>
           <p className="text-xs text-slate-400 mb-8 font-black uppercase tracking-[0.2em] leading-relaxed">System requires a verified Google Maps Platform key for real-time geospatial vector projection.</p>
           <a 
             href="https://console.cloud.google.com/google/maps-apis/start" 
             target="_blank" 
             className="inline-flex items-center space-x-3 px-8 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] shadow-2xl shadow-indigo-100 hover:bg-slate-900 transition-all active:scale-95 group/btn"
           >
             <span>Initialize Authorization</span>
             <MapPin className="w-3.5 h-3.5 transition-transform group-hover/btn:translate-y-[-1px]" />
           </a>
        </div>
      </div>
    );
  }

  const center = { lat: 15.4484, lng: 75.0078 }; // Dharwad/Hubballi center

  return (
    <APIProvider apiKey={API_KEY} version="weekly">
      <div className="rounded-[2.5rem] overflow-hidden h-[600px] border border-slate-200 shadow-xl bg-slate-50 relative group">
        <Map
          defaultCenter={center}
          defaultZoom={13}
          mapId="CHIGARI_POLISHED_MAP"
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          style={{ width: '100%', height: '100%' }}
          disableDefaultUI
        >
          {buses.map(bus => {
            if (!bus.lastLocation) return null;
            const route = routes.find(r => r.id === bus.currentRouteId);
            const isSelected = selectedBusId === bus.id;
            
            return (
              <AdvancedMarker 
                key={bus.id} 
                position={bus.lastLocation}
                title={`Unit ${bus.busNumber}`}
              >
                <div className="relative group/bus">
                   <div 
                     className={cn(
                       "flex items-center justify-center text-white shadow-2xl transition-all duration-300 transform",
                       isSelected ? "w-14 h-14 rounded-2xl ring-4 ring-white scale-110 z-50" : "w-10 h-10 rounded-xl hover:scale-110 hover:z-40"
                     )}
                     style={{ backgroundColor: route?.color || '#334155' }}
                   >
                     <BusIcon className={isSelected ? "w-8 h-8" : "w-5 h-5"} />
                   </div>
                   
                   {/* Label */}
                   <div className={cn(
                     "absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-3 py-1.5 rounded-lg shadow-2xl transition-all font-mono font-bold whitespace-nowrap",
                     isSelected ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 group-hover/bus:opacity-100 group-hover/bus:translate-y-0"
                   )}>
                      {bus.busNumber} • {route?.name || 'OFF-DUTY'}
                   </div>
                   
                   {/* Tooltip triangle */}
                   <div className={cn(
                     "absolute -top-4 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-slate-900 transition-all",
                     isSelected ? "opacity-100" : "opacity-0 group-hover/bus:opacity-100"
                   )} />
                </div>
              </AdvancedMarker>
            );
          })}

          {stops.map(stop => (
             <AdvancedMarker key={stop.id} position={stop.location}>
               <div className="w-3 h-3 bg-white border-2 border-slate-400 rounded-full shadow-sm hover:border-indigo-500 transition-colors cursor-pointer" />
             </AdvancedMarker>
          ))}
        </Map>
        
        {/* Map Legend/Overlay */}
        <div className="absolute top-6 left-6 pointer-events-none">
           <div className="bg-white/80 backdrop-blur-md px-4 py-3 rounded-2xl border border-slate-200 shadow-xl space-y-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Map Filter</p>
              <div className="flex items-center space-x-2">
                 <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-sm" />
                 <span className="text-xs font-bold text-slate-700 uppercase">Live Fleet Status</span>
              </div>
           </div>
        </div>
      </div>
    </APIProvider>
  );
};



