/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  addDoc,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { UserProfile, Route, Bus, Stop, Alert } from "../types";
import { useAuth } from "../lib/AuthContext";
import { logActivity } from "../lib/activityLogger";
import { seedDatabase } from "../lib/seeding";
import {
  Users,
  Map as MapIcon,
  Bus as BusIcon,
  Trash2,
  Plus,
  Edit2,
  Check,
  X,
  Shield,
  MapPin,
  ChevronRight,
  Bell,
  Calendar,
  DollarSign,
  Clock,
  Globe,
  GripVertical,
  ExternalLink,
  Database,
  Sparkles,
  Loader,
} from "lucide-react";
import { cn } from "../lib/utils";
import { BRAND_NAME, BRAND_TAGLINE } from "../constants";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export const AdminDashboard = () => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<
    "users" | "routes" | "buses" | "stops" | "alerts"
  >("routes");
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [stops, setStops] = useState<Stop[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);

  const handleSeed = async () => {
    if (!profile) return;
    setIsSeeding(true);
    setSeedError(null);
    try {
      await seedDatabase(profile);
      await logActivity(
        profile,
        "SEED_DATABASE",
        "Successfully initialized Chigari BRTS database with standard transit matrix, active signals, stations, and scheduled passenger trips",
      );
      alert(
        "Chigari BRTS database successfully initialized with 4 major routes, active buses, 6 stations, and tomorrow's transit trips!",
      );
    } catch (e: any) {
      console.error(e);
      setSeedError(e.message || "Initialization failed");
    } finally {
      setIsSeeding(false);
    }
  };

  useEffect(() => {
    if (profile && profile.role !== "dispatcher") {
      setActiveTab("users");
    }
  }, [profile]);

  useEffect(() => {
    if (!profile) return;

    let unsubscribeUsers = () => {};
    if (profile.role !== "dispatcher") {
      unsubscribeUsers = onSnapshot(collection(db, "users"), (snapshot) =>
        setUsers(snapshot.docs.map((d) => d.data() as UserProfile)),
      );
    }
    const unsubscribeRoutes = onSnapshot(
      collection(db, "routes"),
      (snapshot) => {
        const routesData = snapshot.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as Route,
        );
        setRoutes(
          routesData.sort((a, b) => {
            const numA = parseInt(a.name.match(/\d+/)?.[0] || "0");
            const numB = parseInt(b.name.match(/\d+/)?.[0] || "0");
            return numA - numB;
          }),
        );
      },
    );
    const unsubscribeBuses = onSnapshot(collection(db, "buses"), (snapshot) =>
      setBuses(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Bus)),
    );
    const unsubscribeStops = onSnapshot(collection(db, "stops"), (snapshot) => {
      const stopsData = snapshot.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as Stop,
      );
      setStops(stopsData.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
    });
    const unsubscribeAlerts = onSnapshot(collection(db, "alerts"), (snapshot) =>
      setAlerts(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Alert)),
    );

    return () => {
      unsubscribeUsers();
      unsubscribeRoutes();
      unsubscribeBuses();
      unsubscribeStops();
      unsubscribeAlerts();
    };
  }, [profile]);

  const updateUserRole = async (uid: string, newRole: string) => {
    try {
      const targetUser = users.find((u) => u.uid === uid);
      if (!targetUser) return;

      // Only red_admin can modify someone to red_admin, or modify someone who is a red_admin
      if (newRole === "red_admin" && profile?.role !== "red_admin") {
        alert(
          "Permission Denied: Only the Red Admin can assign Red Admin privileges.",
        );
        return;
      }
      if (targetUser.role === "red_admin" && profile?.role !== "red_admin") {
        alert(
          "Permission Denied: Only the Red Admin can modify another Red Admin's role.",
        );
        return;
      }

      await updateDoc(doc(db, "users", uid), { role: newRole });
      await logActivity(
        profile,
        "ROLE_CHANGE",
        `Changed role of user '${targetUser.email}' from '${targetUser.role}' to '${newRole}'`,
      );
    } catch (e) {
      console.error(e);
      alert("Role update failed. Please verify permissions.");
    }
  };

  const [isAddingRoute, setIsAddingRoute] = useState(false);
  const [isAddingBus, setIsAddingBus] = useState(false);
  const [isAddingStop, setIsAddingStop] = useState(false);
  const [isAddingAlert, setIsAddingAlert] = useState(false);
  const [isEditingAlert, setIsEditingAlert] = useState(false);
  const [editingAlert, setEditingAlert] = useState<Alert | null>(null);

  const handleFirestoreError = (
    error: unknown,
    operation: string,
    path: string,
  ) => {
    const errorInfo = {
      error: error instanceof Error ? error.message : String(error),
      operationType: operation,
      path,
      authInfo: {
        email: "u02cs25s0055@klebcadwd.com",
      },
    };
    console.error("Firestore Error:", JSON.stringify(errorInfo));
    alert(`Failed to ${operation}: ${errorInfo.error}`);
  };
  const [isEditingRoute, setIsEditingRoute] = useState(false);
  const [isEditingStop, setIsEditingStop] = useState(false);
  const [newRoute, setNewRoute] = useState({
    name: "",
    origin: "",
    destination: "",
    busNumber: "",
  });
  const [newBus, setNewBus] = useState({ busNumber: "" });
  const [newStop, setNewStop] = useState({
    name: "",
    stopNumber: "",
    mapUrl: "",
  });

  useEffect(() => {
    setNewStop((prev) => ({
      ...prev,
      stopNumber: String(stops.length + 1),
    }));
  }, [stops.length]);
  const [newAlert, setNewAlert] = useState({
    title: "",
    message: "",
    type: "info" as const,
  });
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [editingStop, setEditingStop] = useState<Stop | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleAddRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newRoute.name && newRoute.origin && newRoute.destination) {
      const routeData = {
        name: newRoute.name,
        origin: newRoute.origin,
        destination: newRoute.destination,
        busNumber: newRoute.busNumber || "N/A",
        color: "#" + Math.floor(Math.random() * 16777215).toString(16),
        order: routes.length,
      };
      await addDoc(collection(db, "routes"), routeData);
      await logActivity(
        profile,
        "CREATE_ROUTE",
        `Created new route '${newRoute.name}' tracking ${newRoute.origin} ⇄ ${newRoute.destination}`,
      );
      setIsAddingRoute(false);
      setNewRoute({ name: "", origin: "", destination: "", busNumber: "" });
    }
  };

  const handleAddBus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newBus.busNumber) {
      await addDoc(collection(db, "buses"), {
        busNumber: newBus.busNumber,
        status: "inactive" as const,
        currentRouteId: "",
        lastLocation: { lat: 15.4484, lng: 75.0078 },
        updatedAt: new Date().toISOString(),
      });
      await logActivity(
        profile,
        "CREATE_BUS",
        `Created new system bus unit '${newBus.busNumber}'`,
      );
      setIsAddingBus(false);
      setNewBus({ busNumber: "" });
    }
  };

  const handleAddStop = async (e: React.FormEvent) => {
    e.preventDefault();
    const computedStopNumber = String(stops.length + 1);
    if (newStop.name) {
      await addDoc(collection(db, "stops"), {
        name: newStop.name,
        stopNumber: computedStopNumber,
        mapUrl: newStop.mapUrl,
        order: stops.length,
        location: { lat: 15.4484, lng: 75.0078 },
      });
      await logActivity(
        profile,
        "CREATE_STOP",
        `Added bus stop #${computedStopNumber} - '${newStop.name}'`,
      );
      setIsAddingStop(false);
      setNewStop({ name: "", stopNumber: "", mapUrl: "" });
    }
  };

  const handleAddAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newAlert.title && newAlert.message) {
      try {
        await addDoc(collection(db, "alerts"), {
          ...newAlert,
          createdAt: new Date().toISOString(),
          createdBy: "admin",
        });
        await logActivity(
          profile,
          "CREATE_ALERT",
          `Created alert notice: '${newAlert.title}'`,
        );
        setIsAddingAlert(false);
        setNewAlert({ title: "", message: "", type: "info" });
      } catch (error) {
        handleFirestoreError(error, "create", "alerts");
      }
    }
  };

  const handleUpdateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingAlert && editingAlert.title && editingAlert.message) {
      try {
        await updateDoc(doc(db, "alerts", editingAlert.id), {
          title: editingAlert.title,
          message: editingAlert.message,
          type: editingAlert.type,
          updatedAt: new Date().toISOString(),
        });
        await logActivity(
          profile,
          "UPDATE_ALERT",
          `Updated alert notification details for '${editingAlert.title}'`,
        );
        setIsEditingAlert(false);
        setEditingAlert(null);
      } catch (error) {
        handleFirestoreError(error, "update", "alerts");
      }
    }
  };

  const handleUpdateStop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingStop && editingStop.name) {
      const { id, ...data } = editingStop;
      const index = stops.findIndex((s) => s.id === id);
      const computedStopNumber = String(index !== -1 ? index + 1 : stops.length + 1);
      await updateDoc(doc(db, "stops", id), {
        ...data,
        stopNumber: computedStopNumber,
      });
      await logActivity(
        profile,
        "UPDATE_STOP",
        `Updated stop details of #${computedStopNumber} - '${editingStop.name}'`,
      );
      setIsEditingStop(false);
      setEditingStop(null);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      if (activeTab === "stops") {
        const oldIndex = stops.findIndex((s) => s.id === active.id);
        const newIndex = stops.findIndex((s) => s.id === over.id);

        const newOrderedStops = arrayMove(stops, oldIndex, newIndex);
        setStops(newOrderedStops);

        const batch = writeBatch(db);
        newOrderedStops.forEach((stop: Stop, index) => {
          batch.update(doc(db, "stops", stop.id), {
            order: index,
            stopNumber: String(index + 1),
          });
        });
        await batch.commit();
        await logActivity(
          profile,
          "REORDER_STOPS",
          `Reordered bus stops priority layout and updated node numbers`,
        );
      } else if (activeTab === "routes") {
        const oldIndex = routes.findIndex((r) => r.id === active.id);
        const newIndex = routes.findIndex((r) => r.id === over.id);

        const newOrderedRoutes = arrayMove(routes, oldIndex, newIndex);
        setRoutes(newOrderedRoutes);

        const batch = writeBatch(db);
        newOrderedRoutes.forEach((route: Route, index) => {
          batch.update(doc(db, "routes", route.id), { order: index });
        });
        await batch.commit();
        await logActivity(
          profile,
          "REORDER_ROUTES",
          `Reordered routes priority sequence`,
        );
      }
    }
  };

  const handleUpdateRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      editingRoute &&
      editingRoute.name &&
      editingRoute.origin &&
      editingRoute.destination
    ) {
      const { id, ...data } = editingRoute;
      await updateDoc(doc(db, "routes", id), data);
      await logActivity(
        profile,
        "UPDATE_ROUTE",
        `Updated route details of '${editingRoute.name}' (${editingRoute.origin} ⇄ ${editingRoute.destination})`,
      );
      setIsEditingRoute(false);
      setEditingRoute(null);
    }
  };

  const deleteItem = async (col: string, id: string) => {
    try {
      await deleteDoc(doc(db, col, id));
      
      if (col === "stops") {
        const remainingStops = stops.filter((s) => s.id !== id);
        const batch = writeBatch(db);
        remainingStops.forEach((stop, index) => {
          batch.update(doc(db, "stops", stop.id), {
            order: index,
            stopNumber: String(index + 1),
          });
        });
        await batch.commit();
      }

      await logActivity(
        profile,
        `DELETE`,
        `Purged item with ID '${id}' from '${col}' database collection and re-indexed stops`,
      );
    } catch (e) {
      console.error("Delete failed:", e);
      alert("Delete failed. Please check permissions.");
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 pb-10">
        <div className="space-y-1">
          <h2 className="text-4xl font-black text-slate-900 tracking-tight uppercase leading-none">
            {BRAND_NAME}
          </h2>
          <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-[0.25em]">
            {BRAND_TAGLINE}
          </p>
        </div>
        <div className="flex bg-slate-100/50 p-1.5 rounded-2xl border border-slate-200 shadow-inner overflow-x-auto no-scrollbar">
          {(["users", "routes", "buses", "stops", "alerts"] as const)
            .filter(
              (tab) => !(tab === "users" && profile?.role === "dispatcher"),
            )
            .map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap",
                  activeTab === tab
                    ? "bg-white text-indigo-600 shadow-md shadow-indigo-100 ring-1 ring-slate-100"
                    : "text-slate-500 hover:text-slate-800",
                )}
              >
                {tab}
              </button>
            ))}
        </div>
      </div>

      {routes.length === 0 && (
        <div className="p-6 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-[2rem] flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
          <div className="flex items-start space-x-4">
            <div className="bg-amber-100 p-3 rounded-2xl text-amber-600 shrink-0">
              <Database className="w-5 h-5 animate-pulse" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-black uppercase tracking-wider text-amber-900 flex items-center gap-2">
                <span>Database Empty Notice</span>
                <span className="px-2 py-0.5 text-[8px] font-black bg-amber-500 text-white rounded-full leading-none tracking-widest">
                  SETUP ASSISTANT
                </span>
              </h4>
              <p className="text-[10px] font-bold text-amber-800/80 uppercase leading-relaxed max-w-xl">
                There are no active routes initialized in your Firestore
                collections, making search dropdowns and schedules empty on the
                home screen. Click below to instantly seed the entire
                Hubballi-Dharwad transit matrix.
              </p>
              {seedError && (
                <p className="text-[10px] font-black text-red-600 uppercase">
                  Error: {seedError}
                </p>
              )}
            </div>
          </div>
          <button
            disabled={isSeeding}
            onClick={handleSeed}
            className="px-6 py-4 bg-amber-600 hover:bg-slate-900 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-xl shadow-amber-200 flex items-center justify-center space-x-2 shrink-0 transition-all cursor-pointer"
          >
            {isSeeding ? (
              <Loader className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 fill-current" />
            )}
            <span>Initialize Transit Database</span>
          </button>
        </div>
      )}

      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden ring-1 ring-slate-100">
        {activeTab === "users" && profile?.role !== "dispatcher" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100">
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">
                    Entity Identity
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">
                    Access Tier
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">
                    Weekly Visits
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] text-right">
                    Protocol Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {[...users]
                  .sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""))
                  .map((u) => (
                    <tr
                      key={u.uid}
                      className="hover:bg-slate-50/40 transition-colors group"
                    >
                      <td className="px-8 py-6">
                        <div className="flex items-center space-x-5">
                          {u.photoURL ? (
                            <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-sm border border-slate-200 shrink-0">
                              <img src={u.photoURL} alt={u.displayName || "User"} className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div
                              className={cn(
                                "w-12 h-12 rounded-2xl flex items-center justify-center font-black border transition-all uppercase italic shrink-0",
                                u.role === "red_admin"
                                  ? "bg-red-50 text-red-500 border-red-200 shadow-sm"
                                  : "bg-slate-100 text-slate-400 border-slate-200 group-hover:bg-white group-hover:shadow-sm",
                              )}
                            >
                              {(u.displayName || "U")[0]}
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-black text-slate-800 uppercase tracking-tight leading-none mb-1 flex items-center space-x-2">
                              <span>{u.displayName || "Anonymous"}</span>
                              {u.role === "red_admin" && (
                                <span className="text-[8px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-md font-bold uppercase border border-red-200">
                                  Main Red Admin
                                </span>
                              )}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono tracking-tighter uppercase font-bold">
                              {u.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="relative inline-block">
                          <select
                            value={u.role}
                            onChange={(e) =>
                              updateUserRole(u.uid, e.target.value)
                            }
                            disabled={
                              u.role === "red_admin" &&
                              profile?.role !== "red_admin"
                            }
                            className={cn(
                              "appearance-none px-3 py-1.5 pr-8 border rounded-lg text-[10px] font-black uppercase tracking-widest focus:ring-2 cursor-pointer transition-all",
                              u.role === "red_admin"
                                ? "bg-red-50 text-red-600 border-red-200 focus:ring-red-500 font-extrabold"
                                : "bg-slate-50 text-slate-600 border-slate-200 focus:ring-indigo-500",
                            )}
                          >
                            {profile?.role === "red_admin" && (
                              <option value="red_admin">Red Admin</option>
                            )}
                            <option value="admin">Admin</option>
                            <option value="dispatcher">Dispatcher</option>
                            <option value="passenger">Passenger</option>
                          </select>
                          <ChevronRight className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none transform rotate-90" />
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded">
                          {u.weeklyVisits || (Math.abs((u.uid || "").split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % 5 + 3)} visits/wk
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="inline-flex items-center space-x-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-100 uppercase tracking-tighter">
                          <Check className="w-3 h-3" />
                          <span>Cleared</span>
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "routes" && (
          <div className="p-8">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Routing Directives
                </h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                  Master spatial route definitions (Drag to reorder)
                </p>
              </div>
              <button
                onClick={() => setIsAddingRoute(true)}
                className="inline-flex items-center space-x-2 px-6 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
              >
                <Plus className="w-4 h-4" />
                <span>New Directive</span>
              </button>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={routes.map((r) => r.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-4">
                  {routes.map((r, index) => (
                    <SortableRouteItem
                      key={r.id}
                      route={r}
                      index={index}
                      onEdit={(route) => {
                        setEditingRoute(route);
                        setIsEditingRoute(true);
                      }}
                      onDelete={(id) => deleteItem("routes", id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        )}

        {activeTab === "buses" && (
          <div className="p-8">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Fleet Inventory
                </h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                  Register and track active units
                </p>
              </div>
              <button
                onClick={() => setIsAddingBus(true)}
                className="inline-flex items-center space-x-2 px-6 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
              >
                <Plus className="w-4 h-4" />
                <span>Add Unit</span>
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...buses]
                .sort((a, b) =>
                  a.busNumber.localeCompare(b.busNumber, undefined, {
                    numeric: true,
                  }),
                )
                .map((b) => (
                  <div
                    key={b.id}
                    className="p-5 bg-white rounded-2xl flex flex-col border border-slate-200 shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-2">
                        <BusIcon className="w-5 h-5 text-indigo-600" />
                        <span className="font-mono font-bold text-slate-900">
                          #{b.busNumber}
                        </span>
                      </div>
                      <button
                        onClick={() => deleteItem("buses", b.id)}
                        className="text-slate-200 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                          Operational Status
                        </span>
                        <span
                          className={cn(
                            "text-[9px] font-black px-2 py-0.5 rounded uppercase",
                            b.status === "active"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-500",
                          )}
                        >
                          {b.status}
                        </span>
                      </div>
                      <div className="pt-3 border-t border-slate-50 flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                          Active Route
                        </span>
                        <span className="text-[10px] font-bold text-slate-900">
                          {routes.find((r) => r.id === b.currentRouteId)
                            ?.name || "NONE"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {activeTab === "stops" && (
          <div className="p-8">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Geospatial Nodes
                </h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                  Master station and hub locations (Drag to reorder)
                </p>
              </div>
              <button
                onClick={() => setIsAddingStop(true)}
                className="inline-flex items-center space-x-2 px-6 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
              >
                <Plus className="w-4 h-4" />
                <span>Map Stop</span>
              </button>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={stops.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-4">
                  {stops.map((s, index) => (
                    <SortableStopItem
                      key={s.id}
                      stop={s}
                      index={index}
                      onEdit={(stop) => {
                        setEditingStop(stop);
                        setIsEditingStop(true);
                      }}
                      onDelete={(id) => deleteItem("stops", id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        )}

        {activeTab === "alerts" && (
          <div className="p-8">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  System Alerts
                </h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                  Broadcast critical information to the network
                </p>
              </div>
              <button
                onClick={() => setIsAddingAlert(true)}
                className="inline-flex items-center space-x-2 px-6 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
              >
                <Plus className="w-4 h-4" />
                <span>New Alert</span>
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...alerts]
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                .map((a) => (
                  <div
                    key={a.id}
                    className={cn(
                      "p-6 rounded-[2rem] border flex flex-col shadow-sm transition-all",
                      a.type === "urgent"
                        ? "bg-red-50 border-red-100"
                        : a.type === "warning"
                          ? "bg-amber-50 border-amber-100"
                          : "bg-white border-slate-100",
                    )}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-2">
                        <Bell
                          className={cn(
                            "w-4 h-4",
                            a.type === "urgent"
                              ? "text-red-500"
                              : a.type === "warning"
                                ? "text-amber-500"
                                : "text-indigo-600",
                          )}
                        />
                        <span
                          className={cn(
                            "text-[10px] font-black uppercase tracking-widest",
                            a.type === "urgent"
                              ? "text-red-700"
                              : a.type === "warning"
                                ? "text-amber-700"
                                : "text-slate-900",
                          )}
                        >
                          {a.title}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => {
                            setEditingAlert(a);
                            setIsEditingAlert(true);
                          }}
                          className="text-slate-300 hover:text-indigo-600 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteItem("alerts", a.id)}
                          className="text-slate-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs font-medium text-slate-600 line-clamp-3 mb-6 flex-1">
                      {a.message}
                    </p>

                    <div className="pt-4 border-t border-slate-100/50 flex justify-between items-center text-[8px] font-black uppercase tracking-[0.2em] text-slate-400">
                      <div className="flex items-center space-x-1.5">
                        <Clock className="w-2.5 h-2.5" />
                        <span>
                          {new Date(a.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded",
                          a.type === "urgent"
                            ? "bg-red-100 text-red-600"
                            : a.type === "warning"
                              ? "bg-amber-100 text-amber-600"
                              : "bg-indigo-50 text-indigo-600",
                        )}
                      >
                        {a.type}
                      </span>
                    </div>
                  </div>
                ))}
              {alerts.length === 0 && (
                <div className="col-span-full py-12 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
                    No active system alerts
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add Route Modal */}
      {isAddingRoute && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            onClick={() => setIsAddingRoute(false)}
          />
          <div className="relative bg-white w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">
                  New Directive
                </h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                  Configure Network Segment
                </p>
              </div>
              <button
                onClick={() => setIsAddingRoute(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <Check className="w-6 h-6 rotate-45 text-slate-300" />
              </button>
            </div>

            <form onSubmit={handleAddRoute} className="p-10 space-y-6">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Route Identifier
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. CH-101"
                      className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-600 text-slate-900 text-xs font-black uppercase tracking-widest placeholder:text-slate-300"
                      value={newRoute.name}
                      onChange={(e) =>
                        setNewRoute({ ...newRoute, name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Bus Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. KA-25"
                      className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-600 text-slate-900 text-xs font-black uppercase tracking-widest placeholder:text-slate-300"
                      value={newRoute.busNumber}
                      onChange={(e) =>
                        setNewRoute({ ...newRoute, busNumber: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Origin Node
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Station A"
                      className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-600 text-slate-900 text-xs font-black uppercase tracking-widest placeholder:text-slate-300"
                      value={newRoute.origin}
                      onChange={(e) =>
                        setNewRoute({ ...newRoute, origin: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Terminal Node
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Station B"
                      className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-600 text-slate-900 text-xs font-black uppercase tracking-widest placeholder:text-slate-300"
                      value={newRoute.destination}
                      onChange={(e) =>
                        setNewRoute({
                          ...newRoute,
                          destination: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    Assigned Vehicle Class
                  </label>
                  <select
                    className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-600 text-slate-900 text-xs font-black uppercase tracking-widest appearance-none cursor-pointer"
                    value={
                      newRoute.name.includes("Sleeper")
                        ? "sleeper"
                        : "executive"
                    }
                    onChange={(e) =>
                      setNewRoute({
                        ...newRoute,
                        name: `${newRoute.name} (${e.target.value.toUpperCase()})`,
                      })
                    }
                  >
                    <option value="executive">Executive Class (2+2)</option>
                    <option value="sleeper">Premium Sleeper (2+1)</option>
                    <option value="multi-axle">Multi-Axle Scania</option>
                  </select>
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
      {isEditingRoute && editingRoute && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            onClick={() => setIsEditingRoute(false)}
          />
          <div className="relative bg-white w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">
                  Modify Directive
                </h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                  Adjusting Route: {editingRoute.name}
                </p>
              </div>
              <button
                onClick={() => setIsEditingRoute(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-slate-300" />
              </button>
            </div>

            <form onSubmit={handleUpdateRoute} className="p-10 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    Route Identifier
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-600 text-slate-900 text-xs font-black uppercase tracking-widest"
                    value={editingRoute.name}
                    onChange={(e) =>
                      setEditingRoute({ ...editingRoute, name: e.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Origin Node
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-600 text-slate-900 text-xs font-black uppercase tracking-widest"
                      value={editingRoute.origin}
                      onChange={(e) =>
                        setEditingRoute({
                          ...editingRoute,
                          origin: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Terminal Node
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-600 text-slate-900 text-xs font-black uppercase tracking-widest"
                      value={editingRoute.destination}
                      onChange={(e) =>
                        setEditingRoute({
                          ...editingRoute,
                          destination: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    Active Bus Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. KA-25"
                    className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-600 text-slate-900 text-xs font-black uppercase tracking-widest"
                    value={editingRoute.busNumber || ""}
                    onChange={(e) =>
                      setEditingRoute({
                        ...editingRoute,
                        busNumber: e.target.value,
                      })
                    }
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

      {/* Add Bus Modal */}
      {isAddingBus && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            onClick={() => setIsAddingBus(false)}
          />
          <div className="relative bg-white w-full max-w-sm rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">
                  Fleet Expansion
                </h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                  Register New Vehicle
                </p>
              </div>
              <button
                onClick={() => setIsAddingBus(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-slate-300" />
              </button>
            </div>

            <form onSubmit={handleAddBus} className="p-10 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  Registration Number
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. RJ-14-PB-9999"
                  className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-600 text-slate-900 text-xs font-black uppercase tracking-widest"
                  value={newBus.busNumber}
                  onChange={(e) => setNewBus({ busNumber: e.target.value })}
                />
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
          </div>
        </div>
      )}

      {/* Add Stop Modal */}
      {isAddingStop && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            onClick={() => setIsAddingStop(false)}
          />
          <div className="relative bg-white w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">
                  Node Configuration
                </h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                  Establishing Geo-Static Point
                </p>
              </div>
              <button
                onClick={() => setIsAddingStop(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-slate-300" />
              </button>
            </div>

            <form onSubmit={handleAddStop} className="p-10 space-y-6">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Stop Code / Number (Auto)
                    </label>
                    <input
                      type="text"
                      disabled
                      placeholder="01"
                      className="w-full px-6 py-4 rounded-2xl bg-slate-100 border-none text-slate-400 text-xs font-black uppercase tracking-widest cursor-not-allowed"
                      value={newStop.stopNumber}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Designated Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Downtown Hub"
                      className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-600 text-slate-900 text-xs font-black uppercase tracking-widest"
                      value={newStop.name}
                      onChange={(e) =>
                        setNewStop({ ...newStop, name: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    Map Location URI
                  </label>
                  <input
                    type="url"
                    placeholder="https://maps.google.com/..."
                    className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-600 text-slate-900 text-xs font-black uppercase tracking-widest"
                    value={newStop.mapUrl}
                    onChange={(e) =>
                      setNewStop({ ...newStop, mapUrl: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="pt-6">
                <button
                  type="submit"
                  className="w-full py-5 bg-indigo-600 hover:bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100 transition-all active:scale-95 flex items-center justify-center space-x-3"
                >
                  <MapPin className="w-4 h-4" />
                  <span>Establish Node</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Edit Stop Modal */}
      {isEditingStop && editingStop && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            onClick={() => setIsEditingStop(false)}
          />
          <div className="relative bg-white w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">
                  Modify Node
                </h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                  Adjusting Geospatial Point: {editingStop.name}
                </p>
              </div>
              <button
                onClick={() => setIsEditingStop(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-slate-300" />
              </button>
            </div>

            <form onSubmit={handleUpdateStop} className="p-10 space-y-6">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Stop Code / Number (Auto)
                    </label>
                    <input
                      type="text"
                      disabled
                      className="w-full px-6 py-4 rounded-2xl bg-slate-100 border-none text-slate-400 text-xs font-black uppercase tracking-widest cursor-not-allowed"
                      value={editingStop.stopNumber || ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Designated Name
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-600 text-slate-900 text-xs font-black uppercase tracking-widest"
                      value={editingStop.name}
                      onChange={(e) =>
                        setEditingStop({ ...editingStop, name: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    Map Location URI
                  </label>
                  <input
                    type="url"
                    className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-600 text-slate-900 text-xs font-black uppercase tracking-widest"
                    value={editingStop.mapUrl || ""}
                    onChange={(e) =>
                      setEditingStop({ ...editingStop, mapUrl: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="pt-6">
                <button
                  type="submit"
                  className="w-full py-5 bg-indigo-600 hover:bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100 transition-all active:scale-95 flex items-center justify-center space-x-3"
                >
                  <Check className="w-4 h-4" />
                  <span>Confirm Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Alert Modal */}
      {isAddingAlert && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            onClick={() => setIsAddingAlert(false)}
          />
          <div className="relative bg-white w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">
                  Emergency Broadcast
                </h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                  Configure Network-Wide Alert
                </p>
              </div>
              <button
                onClick={() => setIsAddingAlert(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-slate-300" />
              </button>
            </div>

            <form onSubmit={handleAddAlert} className="p-10 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    Alert Headline
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Schedule Maintenance"
                    className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-600 text-slate-900 text-xs font-black uppercase tracking-widest"
                    value={newAlert.title}
                    onChange={(e) =>
                      setNewAlert({ ...newAlert, title: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    Detailed Message
                  </label>
                  <textarea
                    required
                    placeholder="Describe the situation..."
                    rows={4}
                    className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-600 text-slate-900 text-xs font-black tracking-wider"
                    value={newAlert.message}
                    onChange={(e) =>
                      setNewAlert({ ...newAlert, message: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    Severity Protocol
                  </label>
                  <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
                    {(["info", "warning", "urgent"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setNewAlert({ ...newAlert, type: t })}
                        className={cn(
                          "flex-1 py-3 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                          newAlert.type === t
                            ? t === "urgent"
                              ? "bg-red-500 text-white shadow-lg"
                              : t === "warning"
                                ? "bg-amber-500 text-white shadow-lg"
                                : "bg-indigo-600 text-white shadow-lg"
                            : "text-slate-400 hover:text-slate-600",
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-6">
                <button
                  type="submit"
                  className="w-full py-5 bg-slate-900 hover:bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center space-x-3"
                >
                  <Bell className="w-4 h-4" />
                  <span>Authorize Broadcast</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Alert Modal */}
      {isEditingAlert && editingAlert && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            onClick={() => setIsEditingAlert(false)}
          />
          <div className="relative bg-white w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">
                  Modify Broadcast
                </h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                  Calibrate Service Bulletin
                </p>
              </div>
              <button
                onClick={() => setIsEditingAlert(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-slate-300" />
              </button>
            </div>

            <form onSubmit={handleUpdateAlert} className="p-10 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    Alert Headline
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-600 text-slate-900 text-xs font-black uppercase tracking-widest"
                    value={editingAlert.title}
                    onChange={(e) =>
                      setEditingAlert({
                        ...editingAlert,
                        title: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    Message Content
                  </label>
                  <textarea
                    required
                    rows={4}
                    className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-600 text-slate-900 text-xs font-black tracking-wider"
                    value={editingAlert.message}
                    onChange={(e) =>
                      setEditingAlert({
                        ...editingAlert,
                        message: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    Protocol Level
                  </label>
                  <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
                    {(["info", "warning", "urgent"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() =>
                          setEditingAlert({ ...editingAlert, type: t })
                        }
                        className={cn(
                          "flex-1 py-3 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                          editingAlert.type === t
                            ? t === "urgent"
                              ? "bg-red-500 text-white shadow-lg"
                              : t === "warning"
                                ? "bg-amber-500 text-white shadow-lg"
                                : "bg-indigo-600 text-white shadow-lg"
                            : "text-slate-400 hover:text-slate-600",
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-6">
                <button
                  type="submit"
                  className="w-full py-5 bg-indigo-600 hover:bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center space-x-3"
                >
                  <Check className="w-4 h-4" />
                  <span>Confirm Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

interface SortableStopItemProps {
  stop: Stop;
  index: number;
  onEdit: (s: Stop) => void;
  onDelete: (id: string) => Promise<void> | void;
}

const SortableStopItem: React.FC<SortableStopItemProps> = ({
  stop,
  index,
  onEdit,
  onDelete,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stop.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : "auto",
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "p-5 bg-white rounded-2xl flex items-center justify-between border border-slate-100 shadow-sm group hover:border-indigo-500 transition-all mb-3",
        isDragging && "shadow-xl border-indigo-500 ring-2 ring-indigo-100",
      )}
    >
      <div className="flex items-center space-x-6 flex-1">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-2 text-slate-300 hover:text-indigo-400 transition-colors"
        >
          <GripVertical className="w-5 h-5" />
        </div>

        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center font-black text-indigo-600 text-[10px] border border-slate-100 shadow-inner">
          {index + 1}
        </div>

        <div className="flex-1">
          <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight leading-none mb-1.5">
            {stop.name}
          </h4>
          <div className="flex items-center space-x-2">
            <span className="text-[8px] font-black bg-indigo-50 text-indigo-400 px-2 py-0.5 rounded uppercase tracking-widest border border-indigo-100/50">
              NODE #{stop.stopNumber || "N/A"}
            </span>
            <span className="text-[9px] text-slate-400 font-mono italic opacity-50 uppercase">
              {stop.id.slice(0, 6)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-1 sm:space-x-2">
        {stop.mapUrl && (
          <a
            href={stop.mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Open on satellite map"
            className="p-3 text-[20px] hover:bg-indigo-50 rounded-xl transition-all grayscale hover:grayscale-0"
          >
            📍
          </a>
        )}
        <button
          onClick={() => onEdit(stop)}
          className="p-3 text-slate-300 hover:text-indigo-600 hover:bg-slate-50 rounded-xl transition-all"
          title="Edit Node"
        >
          <Edit2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDelete(stop.id)}
          className="p-3 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
          title="Purge Node"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

interface SortableRouteItemProps {
  route: Route;
  index: number;
  onEdit: (r: Route) => void;
  onDelete: (id: string) => Promise<void> | void;
}

const SortableRouteItem: React.FC<SortableRouteItemProps> = ({
  route,
  index,
  onEdit,
  onDelete,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: route.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : "auto",
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "p-6 bg-white rounded-2xl flex items-center justify-between border border-slate-100 hover:border-indigo-200 hover:shadow-md transition-all group",
        isDragging && "shadow-xl border-indigo-500 ring-2 ring-indigo-100",
      )}
    >
      <div className="flex items-center space-x-6 flex-1">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-2 text-slate-300 hover:text-indigo-400 transition-colors"
        >
          <GripVertical className="w-5 h-5" />
        </div>

        <div className="relative">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-xl shadow-indigo-100/50"
            style={{ backgroundColor: route.color }}
          >
            {route.name[0]}
          </div>
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-lg flex items-center justify-center shadow-sm border border-slate-100 text-[10px] font-black text-slate-400">
            {index + 1}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-1 flex-1">
          <div className="flex flex-col">
            <div className="flex items-center space-x-3">
              <h4 className="text-base font-black text-slate-900 uppercase tracking-tight">
                Route {route.name}
              </h4>
              {route.busNumber && (
                <span className="text-[9px] font-black bg-indigo-50 text-indigo-600 px-2.5 py-0.5 rounded-full uppercase tracking-[0.1em] border border-indigo-100">
                  Unit: {route.busNumber}
                </span>
              )}
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              Spatial Identity: {route.id.slice(0, 8).toUpperCase()}
            </p>
          </div>

          <div className="flex items-center space-x-4 bg-slate-50/50 px-4 py-2 rounded-xl border border-slate-100">
            <div className="flex flex-col items-center">
              <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">
                Origin
              </span>
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">
                {route.origin}
              </span>
            </div>
            <div className="flex flex-col items-center justify-center px-2">
              <span className="text-sm font-black text-indigo-500 leading-none">
                ⇄
              </span>
            </div>
            <div className="flex flex-col items-center text-right">
              <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">
                Terminal
              </span>
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">
                {route.destination}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <button
          onClick={() => onEdit(route)}
          className="flex items-center space-x-2 px-4 py-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all font-black text-[9px] uppercase tracking-widest group/btn"
        >
          <Edit2 className="w-3.5 h-3.5 group-hover/btn:scale-110 transition-transform" />
          <span className="hidden sm:inline">Modify</span>
        </button>
        <button
          onClick={() => onDelete(route.id)}
          className="flex items-center space-x-2 px-4 py-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all font-black text-[9px] uppercase tracking-widest group/btn"
        >
          <Trash2 className="w-3.5 h-3.5 group-hover/btn:scale-110 transition-transform" />
          <span className="hidden sm:inline">Purge</span>
        </button>
      </div>
    </div>
  );
};
