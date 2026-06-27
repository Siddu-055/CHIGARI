import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { logActivity } from '../lib/activityLogger';
import { Route } from '../types';
import { Map as MapIcon, Plus, Edit2, Trash2, Check, X, ChevronRight, GripVertical } from 'lucide-react';
import { cn } from '../lib/utils';
import { BRAND_NAME, BRAND_TAGLINE } from '../constants';
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export const RoutesPage = () => {
  const { profile } = useAuth();
  const [routes, setRoutes] = useState<Route[]>([]);
  const isAdmin = profile?.role === 'admin' || profile?.role === 'red_admin';
  const isStaff = profile?.role === 'admin' || profile?.role === 'red_admin' || profile?.role === 'dispatcher';

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
    const unsubscribe = onSnapshot(collection(db, 'routes'), (snapshot) => {
      const routesData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Route));
      // Sort numerically by extracting the first sequence of digits from the name
      setRoutes(routesData.sort((a, b) => {
        const numA = parseInt(a.name.match(/\d+/)?.[0] || '0');
        const numB = parseInt(b.name.match(/\d+/)?.[0] || '0');
        return numA - numB;
      }));
    });
    return () => unsubscribe();
  }, []);

  const [isAddingRoute, setIsAddingRoute] = useState(false);
  const [isEditingRoute, setIsEditingRoute] = useState(false);
  const [newRoute, setNewRoute] = useState({ name: '', origin: '', destination: '', busNumber: '' });
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleAddRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (newRoute.name && newRoute.origin && newRoute.destination) {
      const routeData = {
        name: newRoute.name,
        origin: newRoute.origin,
        destination: newRoute.destination,
        busNumber: newRoute.busNumber || 'N/A',
        color: '#'+Math.floor(Math.random()*16777215).toString(16),
        order: routes.length,
        status: 'active'
      };
      await addDoc(collection(db, 'routes'), routeData);
      await logActivity(
        profile,
        'ADD_ROUTE',
        `Successfully added new BRTS Route: ${newRoute.name} (${newRoute.origin} to ${newRoute.destination})`
      );
      setIsAddingRoute(false);
      setNewRoute({ name: '', origin: '', destination: '', busNumber: '' });
    }
  };

  const handleUpdateRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !editingRoute) return;
    if (editingRoute.name && editingRoute.origin && editingRoute.destination) {
      const { id, ...data } = editingRoute;
      await updateDoc(doc(db, 'routes', id), data);
      await logActivity(
        profile,
        'UPDATE_ROUTE',
        `Successfully updated route properties for Route: ${editingRoute.name} (${editingRoute.origin} to ${editingRoute.destination})`
      );
      setIsEditingRoute(false);
      setEditingRoute(null);
    }
  };

  const handleUpdateStatus = async (id: string, status: Route['status']) => {
    if (!isStaff) return;
    const targetRoute = routes.find(r => r.id === id);
    await updateDoc(doc(db, 'routes', id), { status });
    await logActivity(
      profile,
      'UPDATE_ROUTE_STATUS',
      `Changed status of Route: ${targetRoute?.name || id} to state '${status.toUpperCase()}'`
    );
  };

  const deleteRoute = async (id: string) => {
    if (!isAdmin) return;
    const targetRoute = routes.find(r => r.id === id);
    if (confirm('Are you sure you want to delete this route?')) {
      try {
        await deleteDoc(doc(db, 'routes', id));
        await logActivity(
          profile,
          'DELETE_ROUTE',
          `Successfully removed Route: ${targetRoute?.name || id} from database`
        );
      } catch (error) {
        handleFirestoreError(error, 'delete', `routes/${id}`);
      }
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    if (!isAdmin) return;
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = routes.findIndex((r) => r.id === active.id);
      const newIndex = routes.findIndex((r) => r.id === over.id);

      const newOrderedRoutes = arrayMove(routes, oldIndex, newIndex);
      setRoutes(newOrderedRoutes);

      const batch = writeBatch(db);
      newOrderedRoutes.forEach((route: Route, index) => {
        batch.update(doc(db, 'routes', route.id), { order: index });
      });
      await batch.commit();
      await logActivity(
        profile,
        'REORDER_ROUTES',
        `Reordered transit matrix priorities for active BRTS routes`
      );
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-8">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">{BRAND_NAME}</h2>
          <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-widest mt-1">
            {BRAND_TAGLINE}
          </p>
        </div>
        
        {isAdmin && (
          <button 
            onClick={() => setIsAddingRoute(true)}
            className="inline-flex items-center space-x-2 px-6 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
          >
            <Plus className="w-4 h-4" />
            <span>New Directive</span>
          </button>
        )}
      </div>

      <DndContext 
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext 
          items={routes.map(r => r.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-4">
            {routes.map((r, index) => (
              <SortableRouteItem 
                key={r.id} 
                route={r} 
                index={index} 
                isAdmin={isAdmin}
                isStaff={isStaff}
                onEdit={(route) => {
                  setEditingRoute(route);
                  setIsEditingRoute(true);
                }}
                onDelete={(id) => deleteRoute(id)}
                onUpdateStatus={(id, status) => handleUpdateStatus(id, status)}
              />
            ))}
            {routes.length === 0 && (
              <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-slate-200">
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">No routes found in the network</p>
              </div>
            )}
          </div>
        </SortableContext>
      </DndContext>

      {/* Add Route Modal */}
      {isAdmin && isAddingRoute && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={() => setIsAddingRoute(false)} />
          <div className="relative bg-white w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
             <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <div>
                   <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">New Directive</h3>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Configure Network Segment</p>
                </div>
                <button onClick={() => setIsAddingRoute(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                   <X className="w-6 h-6 text-slate-300" />
                </button>
             </div>
             
             <form onSubmit={handleAddRoute} className="p-10 space-y-6">
                <div className="space-y-4">
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Route Identifier</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. CH-101"
                          className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-600 text-slate-900 text-xs font-black uppercase tracking-widest placeholder:text-slate-300"
                          value={newRoute.name}
                          onChange={(e) => setNewRoute({ ...newRoute, name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Bus Number</label>
                        <input
                          type="text"
                          placeholder="e.g. KA-25"
                          className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-600 text-slate-900 text-xs font-black uppercase tracking-widest placeholder:text-slate-300"
                          value={newRoute.busNumber}
                          onChange={(e) => setNewRoute({ ...newRoute, busNumber: e.target.value })}
                        />
                      </div>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Origin Node</label>
                        <input
                          type="text"
                          required
                          placeholder="Station A"
                          className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-600 text-slate-900 text-xs font-black uppercase tracking-widest placeholder:text-slate-300"
                          value={newRoute.origin}
                          onChange={(e) => setNewRoute({ ...newRoute, origin: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Terminal Node</label>
                        <input
                          type="text"
                          required
                          placeholder="Station B"
                          className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-600 text-slate-900 text-xs font-black uppercase tracking-widest placeholder:text-slate-300"
                          value={newRoute.destination}
                          onChange={(e) => setNewRoute({ ...newRoute, destination: e.target.value })}
                        />
                      </div>
                   </div>
                </div>

                <div className="pt-6">
                  <button 
                    type="submit"
                    className="w-full py-5 bg-indigo-600 hover:bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100 transition-all active:scale-95 flex items-center justify-center space-x-3"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Authorize Directive</span>
                  </button>
                </div>
             </form>
          </div>
        </div>
      )}

      {/* Edit Route Modal */}
      {isAdmin && isEditingRoute && editingRoute && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={() => setIsEditingRoute(false)} />
          <div className="relative bg-white w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
             <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <div>
                   <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">Modify Directive</h3>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Adjusting Route: {editingRoute.name}</p>
                </div>
                <button onClick={() => setIsEditingRoute(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                   <X className="w-6 h-6 text-slate-300" />
                </button>
             </div>
             
             <form onSubmit={handleUpdateRoute} className="p-10 space-y-6">
                <div className="space-y-4">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Route Identifier</label>
                      <input
                        type="text"
                        required
                        className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-600 text-slate-900 text-xs font-black uppercase tracking-widest"
                        value={editingRoute.name}
                        onChange={(e) => setEditingRoute({ ...editingRoute, name: e.target.value })}
                      />
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Origin Node</label>
                        <input
                          type="text"
                          required
                          className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-600 text-slate-900 text-xs font-black uppercase tracking-widest"
                          value={editingRoute.origin}
                          onChange={(e) => setEditingRoute({ ...editingRoute, origin: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Terminal Node</label>
                        <input
                          type="text"
                          required
                          className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-600 text-slate-900 text-xs font-black uppercase tracking-widest"
                          value={editingRoute.destination}
                          onChange={(e) => setEditingRoute({ ...editingRoute, destination: e.target.value })}
                        />
                      </div>
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Active Bus Number</label>
                      <input
                        type="text"
                        placeholder="e.g. KA-25"
                        className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-600 text-slate-900 text-xs font-black uppercase tracking-widest"
                        value={editingRoute.busNumber || ''}
                        onChange={(e) => setEditingRoute({ ...editingRoute, busNumber: e.target.value })}
                      />
                   </div>
                </div>

                <div className="pt-6">
                  <button 
                    type="submit"
                    className="w-full py-5 bg-indigo-600 hover:bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100 transition-all active:scale-95 flex items-center justify-center space-x-3"
                  >
                    <Check className="w-4 h-4" />
                    <span>Commit Changes</span>
                  </button>
                </div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};

interface SortableRouteItemProps {
  route: Route;
  index: number;
  isAdmin: boolean;
  isStaff: boolean;
  onEdit: (r: Route) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: Route['status']) => void;
}

const SortableRouteItem: React.FC<SortableRouteItemProps> = ({ route, index, isAdmin, isStaff, onEdit, onDelete, onUpdateStatus }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: route.id, disabled: !isAdmin });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className={cn(
        "p-6 bg-white rounded-3xl flex flex-col md:flex-row md:items-center justify-between border border-slate-100 hover:border-indigo-200 hover:shadow-md transition-all group gap-6",
        isDragging && "shadow-xl border-indigo-500 ring-2 ring-indigo-100"
      )}
    >
      <div className="flex items-center space-x-6 flex-1">
        {isAdmin && (
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-2 text-slate-300 hover:text-indigo-400 transition-colors">
            <GripVertical className="w-5 h-5" />
          </div>
        )}

        <div className="relative">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-xl shadow-indigo-100/50" style={{ backgroundColor: route.color }}>
            {route.name[0]}
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-white rounded-lg flex items-center justify-center shadow-sm border border-slate-100 text-[10px] font-black text-slate-400">
            {index + 1}
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-1 flex-1">
          <div className="flex flex-col">
            <div className="flex items-center space-x-3">
              <h4 className="text-base font-black text-slate-900 uppercase tracking-tight">Route {route.name}</h4>
              {route.busNumber && (
                <span className="text-[9px] font-black bg-indigo-50 text-indigo-600 px-2.5 py-0.5 rounded-full uppercase tracking-[0.1em] border border-indigo-100">
                  Unit: {route.busNumber}
                </span>
              )}
            </div>
            <div className="flex items-center space-x-3 mt-1">
              <span className={cn(
                "text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border transition-colors",
                route.status === 'active' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : 
                route.status === 'inactive' ? "bg-red-50 text-red-600 border-red-100" :
                "bg-blue-50 text-blue-600 border-blue-100"
              )}>
                {route.status || 'active'}
              </span>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">IDC: {route.id.slice(0,6).toUpperCase()}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4 bg-slate-50/50 px-5 py-3 rounded-2xl border border-slate-100">
            <div className="flex flex-col items-center">
              <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Origin</span>
              <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider">{route.origin}</span>
            </div>
            <div className="flex flex-col items-center justify-center px-2">
              <span className="text-sm font-black text-indigo-500 leading-none">⇄</span>
            </div>
            <div className="flex flex-col items-center text-right">
              <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Terminal</span>
              <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider">{route.destination}</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex items-center space-x-4">
        {isStaff && (
          <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100 space-x-1">
            <button
              onClick={() => onUpdateStatus(route.id, 'active')}
              className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                route.status === 'active' || !route.status ? "bg-emerald-500 text-white shadow-sm" : "text-slate-300 hover:text-emerald-500 hover:bg-white"
              )}
              title="Set Active"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-current" />
            </button>
            <button
              onClick={() => onUpdateStatus(route.id, 'inactive')}
              className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                route.status === 'inactive' ? "bg-red-500 text-white shadow-sm" : "text-slate-300 hover:text-red-500 hover:bg-white"
              )}
              title="Set Inactive"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-current" />
            </button>
            <button
              onClick={() => onUpdateStatus(route.id, 'maintenance')}
              className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                route.status === 'maintenance' ? "bg-blue-500 text-white shadow-sm" : "text-slate-300 hover:text-blue-500 hover:bg-white"
              )}
              title="Set Maintenance"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-current" />
            </button>
          </div>
        )}

        {isAdmin && (
          <div className="flex items-center space-x-2 border-l border-slate-100 pl-4">
            <button 
              onClick={() => onEdit(route)} 
              className="p-3 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
              title="Modify Directive"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button 
              onClick={() => onDelete(route.id)} 
              className="p-3 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
              title="Purge Directive"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
