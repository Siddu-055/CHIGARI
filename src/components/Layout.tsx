/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bus, User, LogOut, LayoutDashboard, Settings, MapPin, Bell, Map as MapIcon, FileText, X, Camera, Sun, Moon, Laptop, Check, ShieldCheck, MessageSquare, ShieldAlert } from 'lucide-react';
import { BRAND_LOGO_URL, BRAND_NAME } from '../constants';
import { useAuth } from '../lib/AuthContext';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { db } from '../lib/firebase';
import { updateDoc, doc } from 'firebase/firestore';
import { logActivity } from '../lib/activityLogger';
import { TermsConsent } from './TermsConsent';
import { NotificationCenter } from './NotificationCenter';

const DragDropImageUpload = ({ onImageUploaded, currentImage }: { onImageUploaded: (base64: string) => void, currentImage?: string }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      alert('File is too large. Please select an image under 2MB.');
      return;
    }
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        onImageUploaded(e.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={() => fileInputRef.current?.click()}
      className={cn(
        "border-2 border-dashed rounded-3xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all gap-3 text-center",
        isDragging ? "border-indigo-500 bg-indigo-500/10 scale-95" : "border-slate-200 hover:border-indigo-400 hover:bg-slate-50/50"
      )}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        accept="image/*"
        className="hidden"
      />
      {currentImage ? (
        <div className="relative group w-20 h-20 rounded-2xl overflow-hidden ring-4 ring-indigo-500/20 shadow-md">
          <img src={currentImage} alt="Avatar" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera className="w-5 h-5 text-white" />
          </div>
        </div>
      ) : (
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
          <Camera className="w-6 h-6" />
        </div>
      )}
      <div>
        <p className="text-xs font-black uppercase text-slate-700 tracking-wider">Drag & drop or click to upload</p>
        <p className="text-[9px] font-bold uppercase text-slate-400 mt-1">Supports JPG, PNG, WEBP (Max 2MB)</p>
      </div>
    </div>
  );
};


export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, logOut } = useAuth();
  const location = useLocation();

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [tempDisplayName, setTempDisplayName] = useState('');
  const [tempTheme, setTempTheme] = useState<'light' | 'dark' | 'system'>('light');
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  React.useEffect(() => {
    if (profile) {
      setTempDisplayName(profile.displayName || '');
      setTempTheme(profile.theme || 'light');
    }
  }, [profile]);

  const hasChanges = tempDisplayName !== (profile?.displayName || '') || tempTheme !== (profile?.theme || 'light');

  const navItems = [
    ...(user ? [
      { name: 'TRANSIT', path: '/', icon: Bus },
      { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
      { name: 'Routes', path: '/routes', icon: MapIcon },
      { name: 'Stops', path: '/stops', icon: MapPin },
    ] : []),
    ...(profile?.role === 'admin' || profile?.role === 'red_admin' ? [
      { name: 'Notify', path: '/notify', icon: Bell },
      { name: 'Reports', path: '/reports', icon: ShieldAlert }
    ] : []),
    ...(user ? [
      { name: 'Fleet', path: '/fleet', icon: Bus },
      { name: 'Contact Us', path: '/contact', icon: MessageSquare }
    ] : []),
    ...(profile?.role === 'admin' || profile?.role === 'red_admin' ? [{ name: 'Admin', path: '/admin', icon: Settings }] : []),
    ...(profile?.role === 'admin' || profile?.role === 'red_admin' || profile?.role === 'dispatcher' ? [{ name: 'Dispatcher', path: '/dispatcher', icon: MapPin }] : []),
    ...(profile?.role === 'red_admin' ? [{ name: 'Logs', path: '/admin-logs', icon: FileText }] : []),
  ];

  return (
    <div className="flex h-screen w-full bg-slate-100 dark:bg-slate-950 overflow-hidden font-sans transition-colors duration-200">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-indigo-950 text-slate-300 flex flex-col border-r border-indigo-900 shrink-0 select-none">
        <Link to={user ? "/" : "/login"} className="p-6 flex items-center space-x-3 text-white border-b border-indigo-900/50 group">
          <div className="w-10 h-10 rounded-xl overflow-hidden shadow-lg ring-2 ring-indigo-400/20 bg-white p-1.5 transition-transform group-hover:scale-110 duration-300">
            <img src={BRAND_LOGO_URL} alt={`${BRAND_NAME} Logo`} referrerPolicy="no-referrer" className="w-full h-full object-contain" />
          </div>
          <span className="text-xl font-black tracking-tight uppercase leading-none">{BRAND_NAME}</span>
        </Link>
        
        <nav className="flex-1 py-6 space-y-1 overflow-y-auto no-scrollbar">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "px-6 py-3 flex items-center space-x-3 transition-all relative group",
                location.pathname === item.path
                  ? "bg-indigo-900/40 text-white border-r-4 border-indigo-400 font-black"
                  : "hover:bg-indigo-900/20 text-slate-400 hover:text-slate-100"
              )}
            >
              <item.icon className={cn("w-5 h-5", location.pathname === item.path ? "text-indigo-400" : "text-slate-200 group-hover:text-white")} />
              <span className="text-[11px] uppercase tracking-widest font-black leading-none">{item.name}</span>
            </Link>
          ))}
        </nav>

        {user ? (
          <div 
            onClick={() => setIsProfileOpen(true)}
            className="p-6 border-t border-indigo-900/50 flex items-center space-x-3 bg-indigo-950/50 hover:bg-indigo-900/30 cursor-pointer transition-all duration-200 group shrink-0"
          >
            {profile?.photoURL ? (
              <div className="w-10 h-10 rounded-lg overflow-hidden ring-1 ring-white/10 shrink-0">
                <img src={profile.photoURL} alt={profile.displayName} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-lg bg-indigo-800 flex items-center justify-center font-bold text-white shadow-inner ring-1 ring-white/10 shrink-0 uppercase">
                {profile?.displayName?.[0] || 'U'}
              </div>
            )}
            <div className="flex-1 overflow-hidden font-bold">
              <p className="text-[11px] text-white truncate leading-tight uppercase tracking-tight group-hover:text-indigo-200">{profile?.displayName}</p>
              <p className={cn(
                "text-[10px] uppercase tracking-tighter font-extrabold leading-none mt-0.5",
                profile?.role === 'red_admin' ? "text-red-500 font-extrabold animate-pulse" : "text-indigo-400"
              )}>
                {profile?.role === 'red_admin' ? 'RED ADMIN' : profile?.role}
              </p>
            </div>
            <button
               onClick={(e) => {
                 e.stopPropagation();
                 logOut();
               }}
               className="p-1.5 text-indigo-400 hover:text-red-400 transition-colors shrink-0"
               title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="p-6 border-t border-indigo-900/50">
             <Link 
               to="/login"
               className="flex items-center justify-center space-x-2 w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-all shadow-lg active:scale-95"
             >
                <User className="w-3 h-3" />
                <span>Access Terminal</span>
             </Link>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-8 shrink-0 z-20 shadow-sm transition-colors duration-200">
          <div className="flex items-center space-x-4">
            <h2 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest leading-none">
              {navItems.find(i => i.path === location.pathname)?.name || 'Operations'}
            </h2>
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-800"></div>
            <div className="flex items-center space-x-2 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded shadow-sm ring-1 ring-emerald-100 dark:ring-emerald-900/30">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-[9px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">Live Flow</span>
            </div>
          </div>

          <div className="flex items-center space-x-6 text-slate-500 dark:text-slate-400">
             <NotificationCenter />
             <div className="hidden sm:flex flex-col text-right">
                <span className="text-[9px] font-black uppercase tracking-widest leading-tight">Sector Node</span>
                <span className="inline-block text-[10px] font-mono font-bold tracking-tighter italic">CH-DWD-01</span>
             </div>
          </div>
        </header>

        <section className="flex-1 overflow-y-auto no-scrollbar relative">
          <div className="p-8 lg:p-12 max-w-6xl mx-auto w-full">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ 
                duration: 0.4, 
                ease: [0.22, 1, 0.36, 1], // Custom cubic-bezier for smooth motion
              }}
            >
              {children}
            </motion.div>
          </div>
        </section>

        <footer className="bg-white dark:bg-slate-900 px-8 py-2.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] shrink-0 transition-colors duration-200">
          <div className="flex space-x-8">
            <span>© 2024 CHIGARI</span>
            <span>NODE: AIS-PROD-Z</span>
            <button
              onClick={() => setShowTermsModal(true)}
              className="hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer transition-colors uppercase tracking-[0.3em] font-black"
            >
              TERMS & PRIVACY
            </button>
          </div>
          <div className="flex items-center space-x-2 text-indigo-900/40 dark:text-indigo-400/20">
            <div className="w-1 h-1 rounded-full bg-indigo-400 dark:bg-indigo-600"></div>
            <span>Regional Bus Management Protocol</span>
          </div>
        </footer>
      </main>

      {/* Modern Profile Modal */}
      {isProfileOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-250">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] w-full max-w-md overflow-hidden border border-slate-100 dark:border-slate-800 shadow-2xl relative flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
              <div>
                <h3 className="text-base font-black text-slate-950 dark:text-slate-50 uppercase tracking-wider">PROFILE</h3>
                <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em] mt-0.5">Secure identity configuration</p>
              </div>
              <button 
                onClick={() => {
                  setIsProfileOpen(false);
                  setIsSaved(false);
                }}
                className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 rounded-full transition-colors focus:outline-none"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5 overflow-y-auto no-scrollbar">
              {/* Display Picture Upload */}
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Display Picture (DP)</label>
                <DragDropImageUpload 
                  currentImage={profile?.photoURL}
                  onImageUploaded={async (base64) => {
                    if (user) {
                      try {
                        await updateDoc(doc(db, 'users', user.uid), { photoURL: base64 });
                        await logActivity(
                          profile,
                          'PROFILE_DP_UPDATE',
                          `User ${profile?.email || user.email} successfully updated their display picture`
                        );
                      } catch (err) {
                        console.error("Failed to update profile pic:", err);
                        alert("Error saving display picture. Please try a smaller image.");
                      }
                    }
                  }}
                />
              </div>

              {/* Display Name Input */}
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Display Name</label>
                <input
                  type="text"
                  value={tempDisplayName}
                  onChange={(e) => {
                    setTempDisplayName(e.target.value);
                    setIsSaved(false);
                  }}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all"
                  placeholder="Enter display name"
                />
              </div>

              {/* Gmail Address (Read Only) */}
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Gmail Address</label>
                <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-500 dark:text-slate-400 font-mono flex flex-col gap-1 select-none">
                  <span className="truncate">{profile?.email || user?.email}</span>
                  <span className="text-[7px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">Google Authenticated Account</span>
                </div>
              </div>

              {/* Transit System Affiliation */}
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Transit System Affiliation</label>
                <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-500 dark:text-slate-400 font-mono flex flex-col gap-1 select-none">
                  <span className="truncate font-sans font-black text-[10px] text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">HUBBALLI-DHARWAD BUS RAPID TRANSIT SYSTEM</span>
                  <span className="text-[7px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Active Regional Transit Protocol (CHIGARI)</span>
                </div>
              </div>

              {/* Theme Settings */}
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Theme Configuration</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['light', 'dark', 'system'] as const).map((t) => {
                    const active = tempTheme === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          setTempTheme(t);
                          setIsSaved(false);
                        }}
                        className={cn(
                          "p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all relative overflow-hidden group focus:outline-none",
                          active
                            ? "border-indigo-600 bg-indigo-50/10 dark:bg-indigo-950/20 text-indigo-950 dark:text-indigo-200 shadow-sm"
                            : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-500 hover:text-slate-850 dark:hover:text-slate-200 bg-white dark:bg-slate-900"
                        )}
                      >
                        {t === 'light' && <Sun className={cn("w-4 h-4", active ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300")} />}
                        {t === 'dark' && <Moon className={cn("w-4 h-4", active ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300")} />}
                        {t === 'system' && <Laptop className={cn("w-4 h-4", active ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300")} />}
                        <span className="text-[8px] font-bold uppercase tracking-wider">
                          {t === 'system' ? 'Device Default' : (t === 'light' ? 'Light Mode' : 'Dark Mode')}
                        </span>
                        {active && (
                          <div className="absolute top-1 right-1 w-2.5 h-2.5 bg-indigo-600 dark:bg-indigo-500 rounded-full flex items-center justify-center">
                            <Check className="w-1.5 h-1.5 text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Review Terms link */}
              <div className="pt-2 text-center border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowTermsModal(true)}
                  className="inline-flex items-center space-x-1.5 text-[9px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest transition-colors focus:outline-none cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Review Terms & Privacy Policy</span>
                </button>
              </div>
            </div>

            {/* Modal Footer with Save Button */}
            <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setIsProfileOpen(false);
                  setIsSaved(false);
                }}
                className="px-5 py-2.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
              >
                Close
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!user) return;
                  setIsSaving(true);
                  try {
                    await updateDoc(doc(db, 'users', user.uid), {
                      displayName: tempDisplayName,
                      theme: tempTheme
                    });
                    await logActivity(
                      profile,
                      'PROFILE_UPDATE',
                      `User ${profile?.email || user.email} successfully updated profile settings: name '${tempDisplayName}', theme '${tempTheme}'`
                    );
                    setIsSaved(true);
                  } catch (err) {
                    console.error("Failed to update profile settings:", err);
                    alert("Failed to save profile settings.");
                  } finally {
                    setIsSaving(false);
                  }
                }}
                disabled={isSaving || (!hasChanges && !isSaved)}
                className={cn(
                  "px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-sm",
                  isSaving
                    ? "bg-slate-100 text-slate-400 cursor-wait"
                    : isSaved
                      ? "bg-slate-400 text-white cursor-default"
                      : hasChanges
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                        : "bg-slate-200 text-slate-400 cursor-not-allowed"
                )}
              >
                {isSaving ? "Saving..." : isSaved ? "Saved" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Terms & Privacy Consent Overlay Modal */}
      <TermsConsent forceShow={showTermsModal} onClose={() => setShowTermsModal(false)} />
    </div>
  );
};
