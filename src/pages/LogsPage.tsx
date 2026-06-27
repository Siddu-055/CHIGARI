import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ActivityLog } from '../types';
import { Scroll, Search, Clock, ShieldAlert, Filter, User, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { BRAND_NAME, BRAND_TAGLINE } from '../constants';
import { motion } from 'motion/react';

export const LogsPage = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'system_logs'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog)));
      setLoading(false);
    }, (error) => {
      console.error("Error loading activity logs:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.userEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.details.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRole = roleFilter === 'all' || log.userRole === roleFilter;

    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 pb-10">
        <div className="space-y-1">
          <h2 className="text-4xl font-black text-slate-900 tracking-tight uppercase leading-none">{BRAND_NAME}</h2>
          <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-[0.25em]">{BRAND_TAGLINE}</p>
        </div>
        <div className="flex items-center space-x-2 px-4 py-2 bg-red-50 border border-red-100 rounded-2xl shadow-sm shadow-red-50">
          <ShieldAlert className="w-4 h-4 text-red-600" />
          <span className="text-[10px] font-black text-red-600 uppercase tracking-widest">Protocol Audit Logs</span>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search logs by email, action description, or keywords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 text-slate-700 transition-all placeholder:text-slate-400"
          />
        </div>
        
        <div className="flex items-center space-x-3 w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full md:w-48 appearance-none bg-slate-50 px-4 py-3 border border-slate-200 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer transition-all"
          >
            <option value="all">All Roles</option>
            <option value="red_admin">Red Admin</option>
            <option value="admin">Admin</option>
            <option value="dispatcher">Dispatcher</option>
            <option value="passenger">Passenger</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center uppercase tracking-[0.5em] font-black text-slate-200 text-xs animate-pulse">
          Synchronizing Security Logs...
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-[2rem] border border-slate-200 shadow-sm flex flex-col items-center justify-center space-y-4">
          <Scroll className="w-12 h-12 text-slate-300 stroke-[1.5]" />
          <div className="space-y-1">
            <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">No Records Found</h4>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Adjust your search parameters or check back later</p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden ring-1 ring-slate-100">
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100">
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">Timestamp</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">Identity Profile</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">Operation</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">Trace message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-slate-700">
                {filteredLogs.map((log) => {
                  const date = new Date(log.createdAt);
                  const formattedTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                  const formattedDate = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
                  
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/20 transition-colors group">
                      <td className="px-8 py-5 shrink-0 whitespace-nowrap">
                        <div className="flex items-center space-x-2 text-slate-400">
                          <Clock className="w-3.5 h-3.5 text-slate-300" />
                          <span className="text-[10px] font-mono font-bold">{formattedDate} {formattedTime}</span>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center space-x-3">
                          <div className={cn(
                            "w-8 h-8 rounded-xl font-bold flex items-center justify-center text-[10/px] border",
                            log.userRole === 'red_admin' ? "bg-red-50 text-red-600 border-red-100 shadow-sm" :
                            log.userRole === 'admin' ? "bg-indigo-50 text-indigo-600 border-indigo-100" :
                            log.userRole === 'dispatcher' ? "bg-amber-50 text-amber-600 border-amber-100" :
                            "bg-slate-100 text-slate-600 border-slate-200"
                          )}>
                            {log.userEmail[0]?.toUpperCase() || 'U'}
                          </div>
                          <div>
                            <p className="text-[10px] font-mono leading-none tracking-tight font-black text-slate-700">{log.userEmail}</p>
                            <span className={cn(
                              "inline-block mt-1 text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md leading-none border",
                              log.userRole === 'red_admin' ? "bg-red-50 text-red-600 border-red-200 font-extrabold shadow-sm" :
                              log.userRole === 'admin' ? "bg-indigo-50 text-indigo-600 border-indigo-100" :
                              log.userRole === 'dispatcher' ? "bg-amber-50 text-amber-600 border-amber-100" :
                              "bg-slate-100 text-slate-600 border-slate-200"
                            )}>
                              {log.userRole === 'red_admin' ? 'Red Admin' : log.userRole}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5 uppercase font-black text-[9px] tracking-wider text-slate-500 shrink-0 whitespace-nowrap">
                        <span className="px-2 py-1 bg-slate-100 rounded-md border border-slate-200">
                          {log.action.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-xs text-slate-800 font-bold tracking-tight">
                        {log.details}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
