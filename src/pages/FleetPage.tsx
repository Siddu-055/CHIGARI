import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { logActivity } from '../lib/activityLogger';
import { Bus, Route } from '../types';
import { Bus as BusIcon, Plus, Trash2, Check, X, Activity, Shield, MapPin, Edit2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const cardVariants = {
  hidden: { y: 20, opacity: 0, scale: 0.95 },
  visible: {
    y: 0,
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: [0.22, 1, 0.36, 1]
    }
  }
};

export const FleetPage = () => {
  const { user, profile } = useAuth();
  const [buses, setBuses] = useState<Bus[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const isAdmin = profile?.role === 'admin' || profile?.role === 'red_admin' || profile?.email === 'u02cs25s0055@klebcadwd.com' || user?.email === 'u02cs25s0055@klebcadwd.com';

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
    alert(`Action Failed: ${errorInfo.error}`);
  };

  useEffect(() => {
    onSnapshot(collection(db, 'buses'), snapshot => {
      const busesData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Bus));
      // Sort: Unit Number (if available) then Bus Number
      const sorted = busesData.sort((a, b) => {
        const uA = a.unitNumber || '';
        const uB = b.unitNumber || '';
        if (uA !== uB) return uA.localeCompare(uB, undefined, { numeric: true });
        return a.busNumber.localeCompare(b.busNumber, undefined, { numeric: true });
      });
      setBuses(sorted);
    });
    onSnapshot(collection(db, 'routes'), snapshot => setRoutes(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Route))));
  }, []);

  const [isAddingBus, setIsAddingBus] = useState(false);
  const [newBus, setNewBus] = useState({ busNumber: '', unitNumber: '', registrationNumber: '' });
  const [isEditingBus, setIsEditingBus] = useState(false);
  const [editingBus, setEditingBus] = useState<Bus | null>(null);

  const handleAddBus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (newBus.busNumber) {
      try {
        await addDoc(collection(db, 'buses'), { 
          busNumber: newBus.busNumber, 
          unitNumber: newBus.unitNumber || '',
          registrationNumber: newBus.registrationNumber || '',
          status: 'inactive' as const, 
          currentRouteId: '', 
          lastLocation: { lat: 15.4484, lng: 75.0078 }, 
          updatedAt: new Date().toISOString() 
        });
        await logActivity(
          profile,
          'ADD_BUS',
          `Successfully registered a new BRTS vehicle: #${newBus.busNumber} (Unit: ${newBus.unitNumber || 'N/A'}, Reg: ${newBus.registrationNumber || 'N/A'})`
        );
        setIsAddingBus(false);
        setNewBus({ busNumber: '', unitNumber: '', registrationNumber: '' });
      } catch (error) {
        handleFirestoreError(error, 'add', 'buses');
      }
    }
  };

  const handleUpdateBus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !editingBus) return;
    try {
      await updateDoc(doc(db, 'buses', editingBus.id), {
        busNumber: editingBus.busNumber,
        unitNumber: editingBus.unitNumber || '',
        registrationNumber: editingBus.registrationNumber || '',
        updatedAt: new Date().toISOString()
      });
      await logActivity(
        profile,
        'UPDATE_BUS',
        `Successfully updated vehicle properties for Bus #${editingBus.busNumber} (Unit: ${editingBus.unitNumber || 'N/A'}, Reg: ${editingBus.registrationNumber || 'N/A'})`
      );
      setIsEditingBus(false);
      setEditingBus(null);
    } catch (error) {
      handleFirestoreError(error, 'update', `buses/${editingBus.id}`);
    }
  };

  const isStaff = profile?.role === 'admin' || profile?.role === 'red_admin' || profile?.role === 'dispatcher';

  const updateBusStatus = async (id: string, status: Bus['status']) => {
    if (!isStaff) return;
    try {
      const targetBus = buses.find(b => b.id === id);
      await updateDoc(doc(db, 'buses', id), { 
        status,
        updatedAt: new Date().toISOString()
      });
      await logActivity(
        profile,
        'UPDATE_BUS_STATUS',
        `Changed status of Bus #${targetBus?.busNumber || id} to state '${status.toUpperCase()}'`
      );
    } catch (error) {
      handleFirestoreError(error, 'update', `buses/${id}`);
    }
  };

  const deleteBus = async (id: string) => {
    if (!isAdmin) return;
    try {
      const targetBus = buses.find(b => b.id === id);
      await deleteDoc(doc(db, 'buses', id));
      await logActivity(
        profile,
        'DELETE_BUS',
        `Successfully decommissioned and removed Bus #${targetBus?.busNumber || id} from transit register`
      );
      setConfirmDeleteId(null);
    } catch (error) {
      handleFirestoreError(error, 'delete', `buses/${id}`);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-8">
        <div>
          <div className="flex items-center space-x-2 mb-2">
            <div className="h-0.5 w-6 bg-indigo-600"></div>
            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.4em]">Logistics Assets</span>
          </div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Fleet <span className="text-indigo-600">Inventory</span></h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
            {isStaff ? "Unit registration and operational status oversight" : "Real-time active units and high-frequency deployment"}
          </p>
        </div>
        
        {isAdmin && (
          <button 
            onClick={() => setIsAddingBus(true)}
            className="inline-flex items-center space-x-2 px-6 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
          >
            <Plus className="w-4 h-4" />
            <span>Expand Fleet</span>
          </button>
        )}
      </div>

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
      >
        {buses.map(bus => (
          <motion.div 
            key={bus.id} 
            layout
            variants={cardVariants}
            whileHover={{ y: -8, scale: 1.02 }}
            className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm group hover:border-indigo-500 transition-all relative overflow-hidden"
          >
            {/* Background Accent */}
            <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
               <BusIcon size={160} className="text-indigo-900" />
            </div>

            <div className="flex justify-between items-start relative z-10 mb-8">
              <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 shadow-inner">
                <BusIcon className="w-7 h-7 text-indigo-600" />
              </div>
              <div className="flex flex-col items-end">
                <span className={cn(
                  "text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest border shadow-sm transition-colors",
                  bus.status === 'active' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : 
                  bus.status === 'inactive' ? "bg-red-50 text-red-600 border-red-100" :
                  "bg-blue-50 text-blue-600 border-blue-100"
                )}>
                  {bus.status}
                </span>
                <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest mt-2">Status Node</span>
              </div>
            </div>

            <div className="space-y-6 relative z-10">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-1">Unit Identity</p>
                  <h4 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none italic">#{bus.busNumber}</h4>
                </div>
                {isAdmin && (
                  <button 
                    onClick={() => {
                      setEditingBus(bus);
                      setIsEditingBus(true);
                    }}
                    className="p-2 text-slate-300 hover:text-indigo-600 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {(bus.unitNumber || bus.registrationNumber) && (
                <div className="grid grid-cols-2 gap-4">
                  {bus.unitNumber && (
                    <div>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Unit No</p>
                      <p className="text-xs font-black text-slate-700 uppercase">{bus.unitNumber}</p>
                    </div>
                  )}
                  {bus.registrationNumber && (
                    <div>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Reg No</p>
                      <p className="text-xs font-black text-slate-700 uppercase">{bus.registrationNumber}</p>
                    </div>
                  )}
                </div>
              )}

              {isStaff && (
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => updateBusStatus(bus.id, 'active')}
                    className={cn(
                      "py-2 rounded-xl text-[8px] font-black uppercase tracking-widest border transition-all",
                      bus.status === 'active' ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-emerald-600 border-emerald-100 hover:bg-emerald-50"
                    )}
                  >
                    Active
                  </button>
                  <button
                    onClick={() => updateBusStatus(bus.id, 'inactive')}
                    className={cn(
                      "py-2 rounded-xl text-[8px] font-black uppercase tracking-widest border transition-all",
                      bus.status === 'inactive' ? "bg-red-600 text-white border-red-600" : "bg-white text-red-600 border-red-100 hover:bg-red-50"
                    )}
                  >
                    Inactive
                  </button>
                  <button
                    onClick={() => updateBusStatus(bus.id, 'maintenance')}
                    className={cn(
                      "py-2 rounded-xl text-[8px] font-black uppercase tracking-widest border transition-all",
                      bus.status === 'maintenance' ? "bg-blue-600 text-white border-blue-600" : "bg-white text-blue-600 border-blue-100 hover:bg-blue-50"
                    )}
                  >
                    Other
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center space-x-1">
                    <Activity className="w-2.5 h-2.5" />
                    <span>Sector</span>
                  </p>
                  <p className="text-[10px] font-black text-slate-700 uppercase tracking-tight truncate">
                    {routes.find(r => r.id === bus.currentRouteId)?.name || 'STANDBY'}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center space-x-1">
                    <Shield className="w-2.5 h-2.5" />
                    <span>Type</span>
                  </p>
                  <p className="text-[10px] font-black text-slate-700 uppercase tracking-tight">Executive</p>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-8 border-t border-slate-50 flex items-center justify-between relative z-10">
               <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Telemetry Active</span>
               </div>
               
               {isAdmin && (
                 <div className="flex items-center space-x-2">
                   {confirmDeleteId === bus.id ? (
                      <div className="flex items-center bg-red-50 rounded-xl overflow-hidden border border-red-100 animate-in slide-in-from-right-2">
                        <button 
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-3 py-2 text-[8px] font-black uppercase text-slate-400 hover:text-slate-600 border-r border-red-100"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={() => deleteBus(bus.id)}
                          className="px-3 py-2 text-[8px] font-black uppercase text-red-600 hover:bg-red-500 hover:text-white transition-colors"
                        >
                          Confirm
                        </button>
                      </div>
                   ) : (
                    <button 
                      onClick={() => setConfirmDeleteId(bus.id)}
                      className="p-3 bg-red-50 text-red-400 hover:bg-red-500 hover:text-white rounded-xl transition-all shadow-sm"
                      title="Decommission Unit"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                   )}
                 </div>
               )}
            </div>
          </motion.div>
        ))}
        {buses.length === 0 && (
          <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-slate-200">
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">No fleet assets detected in the inventory</p>
          </div>
        )}
      </motion.div>

      {/* Add Bus Modal */}
      <AnimatePresence>
        {isAdmin && isAddingBus && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" 
              onClick={() => setIsAddingBus(false)} 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white w-full max-w-sm rounded-[2.5rem] overflow-hidden shadow-2xl"
            >
               <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <div>
                   <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">Fleet Expansion</h3>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Register New Vehicle</p>
                </div>
                <button onClick={() => setIsAddingBus(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                   <X className="w-6 h-6 text-slate-300" />
                </button>
             </div>
             
             <form onSubmit={handleAddBus} className="p-10 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Unit Number</label>
                    <input
                      type="text"
                      placeholder="e.g. U-101"
                      className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-600 text-slate-900 text-xs font-black uppercase tracking-widest"
                      value={newBus.unitNumber}
                      onChange={(e) => setNewBus({ ...newBus, unitNumber: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Bus Number (Internal)</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 504"
                      className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-600 text-slate-900 text-xs font-black uppercase tracking-widest"
                      value={newBus.busNumber}
                      onChange={(e) => setNewBus({ ...newBus, busNumber: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Registration Number</label>
                    <input
                      type="text"
                      placeholder="e.g. KA-25-F-0001"
                      className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-600 text-slate-900 text-xs font-black uppercase tracking-widest"
                      value={newBus.registrationNumber}
                      onChange={(e) => setNewBus({ ...newBus, registrationNumber: e.target.value })}
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <button 
                    type="submit"
                    className="w-full py-5 bg-indigo-600 hover:bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100 transition-all active:scale-95 flex items-center justify-center space-x-3"
                  >
                    <Check className="w-4 h-4" />
                    <span>Confirm Registration</span>
                  </button>
                </div>
             </form>
          </motion.div>
        </div>
      )}
      </AnimatePresence>

      {/* Edit Bus Modal */}
      <AnimatePresence>
        {isAdmin && isEditingBus && editingBus && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" 
              onClick={() => setIsEditingBus(false)} 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white w-full max-w-sm rounded-[2.5rem] overflow-hidden shadow-2xl"
            >
               <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                  <div>
                     <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">Modify Asset</h3>
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Calibrate Vehicle Details</p>
                  </div>
                  <button onClick={() => setIsEditingBus(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                     <X className="w-6 h-6 text-slate-300" />
                  </button>
               </div>
               
               <form onSubmit={handleUpdateBus} className="p-10 space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Unit Number</label>
                      <input
                        type="text"
                        className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-600 text-slate-900 text-xs font-black uppercase tracking-widest"
                        value={editingBus.unitNumber || ''}
                        onChange={(e) => setEditingBus({ ...editingBus, unitNumber: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Bus Number (Internal)</label>
                      <input
                        type="text"
                        required
                        className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-600 text-slate-900 text-xs font-black uppercase tracking-widest"
                        value={editingBus.busNumber}
                        onChange={(e) => setEditingBus({ ...editingBus, busNumber: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Registration Number</label>
                      <input
                        type="text"
                        className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-600 text-slate-900 text-xs font-black uppercase tracking-widest"
                        value={editingBus.registrationNumber || ''}
                        onChange={(e) => setEditingBus({ ...editingBus, registrationNumber: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="pt-4">
                    <button 
                      type="submit"
                      className="w-full py-5 bg-indigo-600 hover:bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100 transition-all active:scale-95 flex items-center justify-center space-x-3"
                    >
                      <Check className="w-4 h-4" />
                      <span>Apply Changes</span>
                    </button>
                  </div>
               </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
