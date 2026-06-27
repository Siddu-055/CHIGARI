import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Alert, Trip, Route } from '../types';
import { 
  Bell, 
  X, 
  Check, 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  Clock, 
  Settings, 
  Radio, 
  Route as RouteIcon,
  Compass,
  CheckCheck
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { logActivity } from '../lib/activityLogger';

export const NotificationCenter = () => {
  const { user, profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'alerts' | 'routes'>('alerts');
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [delayedTrips, setDelayedTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [isUpdatingSub, setIsUpdatingSub] = useState(false);
  const [lastReadTimestamp, setLastReadTimestamp] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Subscribe state from profile or local storage
  useEffect(() => {
    if (profile) {
      setPushSubscribed(!!(profile as any).pushSubscribed);
      setLastReadTimestamp((profile as any).lastReadNotifications || 0);
    } else {
      const localSub = localStorage.getItem('push_updates_subscribed');
      setPushSubscribed(localSub === 'true');
      const localRead = localStorage.getItem('last_read_notifications');
      setLastReadTimestamp(localRead ? parseInt(localRead, 10) : 0);
    }
  }, [profile]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Listen to active alerts
  useEffect(() => {
    const q = query(collection(db, 'alerts'), orderBy('createdAt', 'desc'));
    const unsubscribeAlerts = onSnapshot(q, (snapshot) => {
      const fetchedAlerts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Alert));
      setAlerts(fetchedAlerts);
      setLoading(false);
    }, (err) => {
      console.error("Error loading alerts for notification center:", err);
    });

    return () => unsubscribeAlerts();
  }, []);

  // Listen to routes and delayed trips
  useEffect(() => {
    const unsubscribeRoutes = onSnapshot(collection(db, 'routes'), (snapshot) => {
      setRoutes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Route)));
    });

    const unsubscribeTrips = onSnapshot(collection(db, 'trips'), (snapshot) => {
      const fetchedTrips = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Trip));
      // filter for delayed or cancelled trips
      const dynamicDelayed = fetchedTrips.filter(t => t.status === 'delayed' || t.status === 'cancelled');
      setDelayedTrips(dynamicDelayed);
    });

    return () => {
      unsubscribeRoutes();
      unsubscribeTrips();
    };
  }, []);

  // Handle push subscription toggle
  const handleToggleSubscription = async () => {
    if (isUpdatingSub) return;
    setIsUpdatingSub(true);
    const newValue = !pushSubscribed;

    try {
      if (user) {
        await updateDoc(doc(db, 'users', user.uid), {
          pushSubscribed: newValue
        });
        await logActivity(
          profile,
          'NOTIFICATION_PREFERENCE_UPDATE',
          `User ${profile?.email || user.email} updated push notification subscription status to: ${newValue ? 'SUBSCRIBED' : 'UNSUBSCRIBED'}`
        );
      } else {
        localStorage.setItem('push_updates_subscribed', String(newValue));
      }
      setPushSubscribed(newValue);
    } catch (err) {
      console.error("Failed to update notification subscription preference:", err);
    } finally {
      setIsUpdatingSub(false);
    }
  };

  // Mark all notifications as read
  const handleMarkAllRead = async () => {
    const now = Date.now();
    setLastReadTimestamp(now);
    if (user) {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          lastReadNotifications: now
        });
      } catch (err) {
        console.error("Failed to update last read notification timestamp:", err);
      }
    } else {
      localStorage.setItem('last_read_notifications', String(now));
    }
  };

  // Get Route Name by ID
  const getRouteName = (routeId: string) => {
    const r = routes.find(route => route.id === routeId);
    return r ? `${r.name} (${r.origin} ➔ ${r.destination})` : 'Active Transit Line';
  };

  // Unread counts
  const unreadAlerts = alerts.filter(a => new Date(a.createdAt).getTime() > lastReadTimestamp);
  
  // Format dynamic route updates
  const routeUpdates = delayedTrips.map(trip => ({
    id: trip.id,
    title: trip.status === 'delayed' ? 'Transit Route Delay' : 'Trip Cancelled',
    message: `Trip departing at ${trip.departureTime} for route "${getRouteName(trip.routeId)}" is currently ${trip.status === 'delayed' ? 'delayed (expect 15-20 min transit deviation)' : 'cancelled'}.`,
    type: trip.status === 'delayed' ? 'warning' : 'urgent',
    createdAt: trip.date ? `${trip.date}T${trip.departureTime}:00` : new Date().toISOString()
  }));

  const unreadRoutes = routeUpdates.filter(ru => new Date(ru.createdAt).getTime() > lastReadTimestamp);
  const totalUnreadCount = unreadAlerts.length + unreadRoutes.length;

  return (
    <div className="relative select-none" ref={containerRef}>
      {/* Trigger Bell Icon */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen && totalUnreadCount > 0) {
            // mark as read on open optionally or via button
          }
        }}
        className={cn(
          "p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all hover:scale-105 active:scale-95 relative focus:outline-none cursor-pointer shadow-sm"
        )}
      >
        <Bell className="w-5 h-5" />
        {totalUnreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-rose-500 text-white font-black text-[8px] min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1 animate-pulse border-2 border-white dark:border-slate-900">
            {totalUnreadCount}
          </span>
        )}
      </button>

      {/* Floating Center Dropdown Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 mt-3 w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Radio className="w-4 h-4 text-indigo-600 animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Live Broadcasts</span>
                </div>
                {totalUnreadCount > 0 && (
                  <button 
                    onClick={handleMarkAllRead}
                    className="flex items-center space-x-1 text-[9px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 transition-all"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Clear All</span>
                  </button>
                )}
              </div>

              {/* Push Subscription Toggle Switch */}
              <div className="flex items-center justify-between p-3.5 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded-2xl shadow-sm">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide">Push Broadcasts</span>
                  <span className="text-[8px] text-slate-400 dark:text-slate-500 font-medium">Subscribe to network push updates</span>
                </div>
                <button
                  onClick={handleToggleSubscription}
                  disabled={isUpdatingSub}
                  className={cn(
                    "w-11 h-6 rounded-full p-0.5 transition-colors duration-300 focus:outline-none flex items-center relative",
                    pushSubscribed ? "bg-emerald-600" : "bg-slate-200 dark:bg-slate-800"
                  )}
                >
                  <motion.div 
                    layout
                    className="w-5 h-5 bg-white rounded-full shadow-sm"
                    animate={{ x: pushSubscribed ? 20 : 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setActiveTab('alerts')}
                className={cn(
                  "flex-1 py-3 text-[10px] font-black uppercase tracking-widest text-center border-b-2 transition-all focus:outline-none",
                  activeTab === 'alerts' 
                    ? "border-indigo-600 text-indigo-600 dark:text-indigo-400" 
                    : "border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600"
                )}
              >
                System Alerts ({alerts.length})
              </button>
              <button
                onClick={() => setActiveTab('routes')}
                className={cn(
                  "flex-1 py-3 text-[10px] font-black uppercase tracking-widest text-center border-b-2 transition-all focus:outline-none",
                  activeTab === 'routes' 
                    ? "border-indigo-600 text-indigo-600 dark:text-indigo-400" 
                    : "border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600"
                )}
              >
                Route Updates ({routeUpdates.length})
              </button>
            </div>

            {/* List Content */}
            <div className="max-h-80 overflow-y-auto no-scrollbar p-3 space-y-2 bg-slate-50/20 dark:bg-slate-950/20">
              {activeTab === 'alerts' ? (
                <>
                  {alerts.map((alert) => {
                    const isNew = new Date(alert.createdAt).getTime() > lastReadTimestamp;
                    return (
                      <div 
                        key={alert.id}
                        className={cn(
                          "p-4 rounded-2xl border bg-white dark:bg-slate-900 transition-all flex items-start gap-3 shadow-sm",
                          isNew ? "border-indigo-100 dark:border-indigo-900 bg-indigo-50/10" : "border-slate-100 dark:border-slate-850"
                        )}
                      >
                        <div className={cn(
                          "p-2 rounded-xl shrink-0 mt-0.5",
                          alert.type === 'urgent' ? "bg-red-50 text-red-500" :
                          alert.type === 'warning' ? "bg-amber-50 text-amber-500" :
                          "bg-indigo-50 text-indigo-500"
                        )}>
                          {alert.type === 'urgent' ? <AlertCircle className="w-4 h-4" /> :
                           alert.type === 'warning' ? <AlertTriangle className="w-4 h-4" /> :
                           <Info className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <h4 className="text-xs font-extrabold text-slate-900 dark:text-slate-100 truncate">{alert.title}</h4>
                            {isNew && (
                              <span className="shrink-0 bg-indigo-600 text-white text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full">NEW</span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-normal mb-1.5">{alert.message}</p>
                          <div className="flex items-center gap-1 text-[8px] font-black uppercase tracking-wider text-slate-400">
                            <Clock className="w-2.5 h-2.5" />
                            <span>{new Date(alert.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {alerts.length === 0 && (
                    <div className="py-12 text-center">
                      <Compass className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No Active Broadcasts</p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {routeUpdates.map((update) => {
                    const isNew = new Date(update.createdAt).getTime() > lastReadTimestamp;
                    return (
                      <div 
                        key={update.id}
                        className={cn(
                          "p-4 rounded-2xl border bg-white dark:bg-slate-900 transition-all flex items-start gap-3 shadow-sm",
                          isNew ? "border-indigo-100 dark:border-indigo-900 bg-indigo-50/10" : "border-slate-100 dark:border-slate-850"
                        )}
                      >
                        <div className={cn(
                          "p-2 rounded-xl shrink-0 mt-0.5",
                          update.type === 'urgent' ? "bg-red-50 text-red-500" : "bg-amber-50 text-amber-500"
                        )}>
                          <RouteIcon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <h4 className="text-xs font-extrabold text-slate-900 dark:text-slate-100 truncate">{update.title}</h4>
                            {isNew && (
                              <span className="shrink-0 bg-indigo-600 text-white text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full">NEW</span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-normal mb-1.5">{update.message}</p>
                          <div className="flex items-center gap-1 text-[8px] font-black uppercase tracking-wider text-slate-400">
                            <Clock className="w-2.5 h-2.5" />
                            <span>Live Update</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {routeUpdates.length === 0 && (
                    <div className="py-12 text-center">
                      <RouteIcon className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">All routes operating normally</p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-center">
              <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Regional Bus Protocol CHIGARI</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
