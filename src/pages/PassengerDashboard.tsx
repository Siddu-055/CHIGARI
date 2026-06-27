/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { logActivity } from '../lib/activityLogger';
import { Route as BusRoute, Booking, Trip, Alert } from '../types';
import { Star, MapPin, Search, Bell, Bus, Activity, Map as MapIcon, Compass, Ticket, Trash2, Clock } from 'lucide-react';
import { cn } from '../lib/utils';
import { BRAND_NAME, BRAND_TAGLINE } from '../constants';

export const PassengerDashboard = () => {
  const { profile } = useAuth();
  const [favoriteRoutes, setFavoriteRoutes] = useState<BusRoute[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [routes, setRoutes] = useState<BusRoute[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  const handleFirestoreError = (error: unknown, operation: string, path: string) => {
    const errorInfo = {
      error: error instanceof Error ? error.message : String(error),
      operationType: operation,
      path,
      authInfo: {
        userId: profile?.uid,
        email: profile?.email,
      }
    };
    console.error('Firestore Error:', JSON.stringify(errorInfo));
  };

  useEffect(() => {
    const unsubscibers: (() => void)[] = [];

    const unsubRoutes = onSnapshot(collection(db, 'routes'), snapshot => {
      const routesData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as BusRoute));
      const sorted = routesData.sort((a, b) => {
        const numA = parseInt(a.name.match(/\d+/)?.[0] || '0');
        const numB = parseInt(b.name.match(/\d+/)?.[0] || '0');
        return numA - numB;
      });
      setFavoriteRoutes(sorted);
      setRoutes(sorted);
    });
    unsubscibers.push(unsubRoutes);

    const unsubTrips = onSnapshot(collection(db, 'trips'), snapshot => {
      setTrips(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Trip)));
    });
    unsubscibers.push(unsubTrips);

    const unsubAlerts = onSnapshot(collection(db, 'alerts'), snapshot => {
      setAlerts(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Alert)));
    }, (err) => handleFirestoreError(err, 'get', 'alerts'));
    unsubscibers.push(unsubAlerts);
    
    if (profile?.uid) {
      const qBookings = query(collection(db, 'bookings'), where('userId', '==', profile.uid));
      const unsubBookings = onSnapshot(qBookings, snapshot => {
        setBookings(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Booking)));
      }, (err) => handleFirestoreError(err, 'get', 'bookings'));
      unsubscibers.push(unsubBookings);
    } else {
      setBookings([]);
    }

    return () => {
      unsubscibers.forEach(unsub => unsub());
    };
  }, [profile]);

  const deleteBooking = async (id: string) => {
    if (confirm('Cancel this reservation?')) {
      await deleteDoc(doc(db, 'bookings', id));
      await logActivity(
        profile,
        'CANCEL_BOOKING',
        `Cancelled bus ticket reservation ID 'TR-${id}'`
      );
    }
  };

  return (
    <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-500 pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-slate-200 pb-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">{BRAND_NAME}</h2>
          <p className="text-[10px] text-indigo-500 font-black uppercase tracking-[0.3em]">{BRAND_TAGLINE}</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="text-right hidden sm:block">
             <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none">Profile</p>
             <p className="text-xs font-bold text-slate-700 truncate max-w-[120px]">{profile?.displayName}</p>
          </div>
          <button className="p-2.5 bg-white rounded-xl shadow-sm border border-slate-100 hover:border-indigo-200 transition-all text-slate-400 hover:text-indigo-600">
            <Bell className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          <div className="space-y-6">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] flex items-center space-x-2">
              <Ticket className="w-4 h-4 text-indigo-500" />
              <span>Current Trip Reservations</span>
            </h3>

            <div className="space-y-4">
               {bookings.length > 0 ? bookings.map(booking => {
                 const trip = trips.find(t => t.id === booking.tripId);
                 const route = routes.find(r => r.id === trip?.routeId);
                 
                 return (
                   <div key={booking.id} className="bg-white p-6 rounded-3xl border border-slate-200 border-l-[6px] border-l-indigo-600 shadow-sm flex items-center justify-between">
                      <div className="flex items-center space-x-6">
                         <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-indigo-600">
                            <Bus className="w-6 h-6" />
                         </div>
                         <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{trip?.date} • {trip?.departureTime}</p>
                            <h4 className="text-sm font-black text-slate-900 uppercase">CH-{route?.name}: {route?.origin} ⇆ {route?.destination}</h4>
                            <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest mt-1">Seats: {booking.seatNumbers.join(', ')} • ₹{booking.totalAmount}</p>
                         </div>
                      </div>
                      <button onClick={() => deleteBooking(booking.id)} className="p-3 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                         <Trash2 className="w-4 h-4" />
                      </button>
                   </div>
                 );
               }) : (
                 <div className="py-12 text-center bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">No active reservations detected</p>
                 </div>
               )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] flex items-center space-x-2">
              <Compass className="w-4 h-4 text-indigo-500" />
              <span>Available High-Frequency Routes</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {favoriteRoutes.filter(r => r.status === 'active' || !r.status).map(route => (
              <div key={route.id} className="bg-white p-6 rounded-2xl border border-slate-200 group hover:border-indigo-400 transition-all relative overflow-hidden shadow-sm">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                   <Bus size={64} className="text-slate-300" />
                </div>
                
                <div className="flex justify-between items-start mb-6">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-xs shadow-lg" style={{ backgroundColor: route.color }}>
                     {route.name}
                  </div>
                  <div className="flex items-center space-x-2">
                    {route.status && (
                       <span className={cn(
                        "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded",
                        route.status === 'active' ? "text-emerald-500 bg-emerald-50" :
                        route.status === 'inactive' ? "text-red-500 bg-red-50" : "text-blue-500 bg-blue-50"
                      )}>
                        {route.status}
                      </span>
                    )}
                    <button className="text-slate-200 hover:text-indigo-500 transition-colors">
                      <Star className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1 mb-6 text-center">
                  <h4 className="text-base font-black text-slate-900 tracking-tight">{route.origin}</h4>
                  <div className="flex items-center space-x-2 py-1 select-none">
                     <div className="h-px flex-1 bg-slate-200" />
                     <span className="text-[10px] text-indigo-500 font-extrabold flex items-center">
                       <span>⇄</span>
                     </span>
                     <div className="h-px flex-1 bg-slate-200" />
                  </div>
                  <h4 className="text-base font-black text-slate-900 tracking-tight">{route.destination}</h4>
                </div>

                <button className="w-full py-3 bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-600 hover:text-white hover:shadow-lg hover:shadow-indigo-100 transition-all">
                  Access Real-time Tracking
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Protocol Broadcasts</h4>
              </div>
              <Link to="/alerts" className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline bg-indigo-50 px-2 py-1 rounded">View All</Link>
            </div>

            {alerts.length > 0 ? (
              alerts.slice(0, 4).map(alert => (
                <Link key={alert.id} to="/alerts" className={cn(
                  "rounded-2xl p-5 border flex items-start space-x-4 transition-all hover:-translate-y-0.5 hover:shadow-lg duration-200 block relative overflow-hidden",
                  alert.type === 'urgent' ? "bg-red-50/50 border-red-200/60 shadow-sm" :
                  alert.type === 'warning' ? "bg-amber-50/50 border-amber-200/60 shadow-sm" :
                  "bg-indigo-50/40 border-indigo-100/60 shadow-sm"
                )}>
                   {/* Left Accent indicator */}
                   <div className={cn(
                     "absolute left-0 top-0 bottom-0 w-1",
                     alert.type === 'urgent' ? "bg-red-500" :
                     alert.type === 'warning' ? "bg-amber-500" :
                     "bg-indigo-500"
                   )} />

                   <div className={cn(
                     "p-2 rounded-xl shrink-0 shadow-sm",
                     alert.type === 'urgent' ? "bg-red-100 text-red-700" :
                     alert.type === 'warning' ? "bg-amber-100 text-amber-700" :
                     "bg-indigo-100 text-indigo-700"
                   )}>
                      <Bell className="w-4 h-4" />
                   </div>
                   <div className="min-w-0">
                     <span className={cn(
                       "text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded inline-block mb-1.5",
                       alert.type === 'urgent' ? "bg-red-100/80 text-red-800" :
                       alert.type === 'warning' ? "bg-amber-100/80 text-amber-800" :
                       "bg-indigo-100/80 text-indigo-800"
                     )}>
                       {alert.type}
                     </span>
                     <h4 className="text-xs font-black uppercase tracking-tight text-slate-900 truncate leading-tight">{alert.title}</h4>
                     <p className="text-[10px] font-bold text-slate-500 leading-tight mt-1 line-clamp-2">{alert.message}</p>
                   </div>
                </Link>
              ))
            ) : (
              <div className="bg-indigo-50/40 rounded-2xl p-6 border border-indigo-100 flex items-start space-x-4 shadow-sm relative overflow-hidden">
                 <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500" />
                 <div className="bg-indigo-100 p-2.5 rounded-xl shadow-sm">
                    <Activity className="w-4 h-4 text-indigo-600 animate-pulse" />
                 </div>
                 <div>
                   <h4 className="text-xs font-black text-indigo-950 uppercase tracking-tight">System Operational</h4>
                   <p className="text-[10px] text-indigo-700/70 font-bold leading-relaxed mt-1">Network traffic is currently within nominal parameters. 100% of fleet units are reporting active telemetry.</p>
                 </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
