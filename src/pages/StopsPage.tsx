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
import { useAuth } from "../lib/AuthContext";
import { logActivity } from "../lib/activityLogger";
import { Stop, Bus } from "../types";
import {
  MapPin,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  GripVertical,
} from "lucide-react";
import { cn } from "../lib/utils";
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

const DEFAULT_QUICK_BUSES = ["100B", "100D", "200A", "201B", "202C"];

export const StopsPage = () => {
  const { profile } = useAuth();
  const [stops, setStops] = useState<Stop[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const isAdmin = profile?.role === "admin" || profile?.role === "red_admin";
  const isStaff =
    profile?.role === "admin" ||
    profile?.role === "red_admin" ||
    profile?.role === "dispatcher";

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
        userId: profile?.uid,
        email: profile?.email,
      },
    };
    console.error("Firestore Error:", JSON.stringify(errorInfo));
    alert(`Action Failed: ${errorInfo.error}`);
  };

  useEffect(() => {
    const unsubscribeStops = onSnapshot(collection(db, "stops"), (snapshot) => {
      const stopsData = snapshot.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as Stop,
      );
      setStops(stopsData.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
    });
    const unsubscribeBuses = onSnapshot(collection(db, "buses"), (snapshot) => {
      setBuses(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Bus));
    });
    return () => {
      unsubscribeStops();
      unsubscribeBuses();
    };
  }, []);

  const [isAddingStop, setIsAddingStop] = useState(false);
  const [isEditingStop, setIsEditingStop] = useState(false);
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

  const [editingStop, setEditingStop] = useState<Stop | null>(null);
  const [newStopOnlyBuses, setNewStopOnlyBuses] = useState<string[]>([]);
  const [editingStopOnlyBuses, setEditingStopOnlyBuses] = useState<string[]>(
    [],
  );
  const [newStopCustomBus, setNewStopCustomBus] = useState("");
  const [editingStopCustomBus, setEditingStopCustomBus] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleAddStop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    const computedStopNumber = String(stops.length + 1);
    if (newStop.name) {
      await addDoc(collection(db, "stops"), {
        name: newStop.name,
        stopNumber: computedStopNumber,
        mapUrl: newStop.mapUrl,
        order: stops.length,
        status: "active",
        location: { lat: 15.4484, lng: 75.0078 },
        onlyTheseBuses: newStopOnlyBuses,
      });
      await logActivity(
        profile,
        "ADD_STOP",
        `Successfully added new BRTS Smart Station: ${newStop.name} (Code: ${computedStopNumber})`,
      );
      setIsAddingStop(false);
      setNewStop({ name: "", stopNumber: "", mapUrl: "" });
      setNewStopOnlyBuses([]);
    }
  };

  const handleUpdateStop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !editingStop) return;
    if (editingStop.name) {
      const { id, ...data } = editingStop;
      const index = stops.findIndex((s) => s.id === id);
      const computedStopNumber = String(index !== -1 ? index + 1 : stops.length + 1);
      await updateDoc(doc(db, "stops", id), {
        ...data,
        stopNumber: computedStopNumber,
        onlyTheseBuses: editingStopOnlyBuses,
      });
      await logActivity(
        profile,
        "UPDATE_STOP",
        `Successfully updated properties for Station: ${editingStop.name} (Code: ${computedStopNumber})`,
      );
      setIsEditingStop(false);
      setEditingStop(null);
      setEditingStopOnlyBuses([]);
    }
  };

  const handleUpdateStatus = async (id: string, status: Stop["status"]) => {
    if (!isStaff) return;
    const targetStop = stops.find((s) => s.id === id);
    await updateDoc(doc(db, "stops", id), { status });
    await logActivity(
      profile,
      "UPDATE_STOP_STATUS",
      `Changed status of Station: ${targetStop?.name || id} to state '${status.toUpperCase()}'`,
    );
  };

  const deleteStop = async (id: string) => {
    if (!isAdmin) return;
    const targetStop = stops.find((s) => s.id === id);
    if (confirm("Are you sure you want to delete this stop?")) {
      try {
        await deleteDoc(doc(db, "stops", id));
        const remainingStops = stops.filter((s) => s.id !== id);
        const batch = writeBatch(db);
        remainingStops.forEach((stop, index) => {
          batch.update(doc(db, "stops", stop.id), {
            order: index,
            stopNumber: String(index + 1),
          });
        });
        await batch.commit();

        await logActivity(
          profile,
          "DELETE_STOP",
          `Successfully removed Station: ${targetStop?.name || id} from database and re-indexed remaining nodes`,
        );
      } catch (error) {
        handleFirestoreError(error, "delete", `stops/${id}`);
      }
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    if (!isAdmin) return;
    const { active, over } = event;

    if (over && active.id !== over.id) {
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
        `Reordered geographical priorities for Hubballi-Dharwad stations and auto-updated node numbers`,
      );
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-8">
        <div>
          <div className="flex items-center space-x-2 mb-2">
            <div className="h-0.5 w-6 bg-indigo-600"></div>
            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.4em]">
              Geo-Spatial Nodes
            </span>
          </div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">
            Station <span className="text-indigo-600">Inventory</span>
          </h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
            {isStaff
              ? "Master node oversight and operational status tracking"
              : "Active station network and designated hub locations"}
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setIsAddingStop(true)}
            className="inline-flex items-center space-x-2 px-6 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
          >
            <Plus className="w-4 h-4" />
            <span>Map New Hub</span>
          </button>
        )}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stops.map((s, index) => (
              <SortableStopItem
                key={s.id}
                stop={s}
                index={index}
                isAdmin={isAdmin}
                isStaff={isStaff}
                onEdit={(stop) => {
                  setEditingStop(stop);
                  setEditingStopOnlyBuses(stop.onlyTheseBuses || []);
                  setIsEditingStop(true);
                }}
                onDelete={(id) => deleteStop(id)}
                onUpdateStatus={(id, status) => handleUpdateStatus(id, status)}
              />
            ))}
            {stops.length === 0 && (
              <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-slate-200">
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
                  No geospatial nodes detected
                </p>
              </div>
            )}
          </div>
        </SortableContext>
      </DndContext>

      {/* Add Stop Modal */}
      {isAdmin && isAddingStop && (
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
                      className="w-full px-6 py-4 rounded-2xl bg-slate-100 border-none text-slate-400 text-xs font-black uppercase tracking-widest appearance-none cursor-not-allowed"
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
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    Only These Buses Stop
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. 100B, 201B, 305A"
                      className="flex-1 px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-600 text-slate-900 text-xs font-black uppercase tracking-widest"
                      value={newStopCustomBus}
                      onChange={(e) => setNewStopCustomBus(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (
                            newStopCustomBus.trim() &&
                            !newStopOnlyBuses.includes(newStopCustomBus.trim())
                          ) {
                            setNewStopOnlyBuses([
                              ...newStopOnlyBuses,
                              newStopCustomBus.trim(),
                            ]);
                            setNewStopCustomBus("");
                          }
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          newStopCustomBus.trim() &&
                          !newStopOnlyBuses.includes(newStopCustomBus.trim())
                        ) {
                          setNewStopOnlyBuses([
                            ...newStopOnlyBuses,
                            newStopCustomBus.trim(),
                          ]);
                          setNewStopCustomBus("");
                        }
                      }}
                      className="px-6 py-4 bg-indigo-600 hover:bg-slate-950 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all font-mono"
                    >
                      Add
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block ml-1">
                      Quick Group Presets
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const allExist = DEFAULT_QUICK_BUSES.every((b) =>
                            newStopOnlyBuses.includes(b),
                          );
                          if (allExist) {
                            setNewStopOnlyBuses(
                              newStopOnlyBuses.filter(
                                (b) => !DEFAULT_QUICK_BUSES.includes(b),
                              ),
                            );
                          } else {
                            setNewStopOnlyBuses(
                              Array.from(
                                new Set([...newStopOnlyBuses, ...DEFAULT_QUICK_BUSES]),
                              ),
                            );
                          }
                        }}
                        className={cn(
                          "py-2 px-3 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all text-center",
                          DEFAULT_QUICK_BUSES.every((b) =>
                            newStopOnlyBuses.includes(b),
                          )
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                            : "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-100",
                        )}
                      >
                        ALL ({DEFAULT_QUICK_BUSES.join(", ")})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const limitedGroup = ["200A", "201B", "202C"];
                          const allExist = limitedGroup.every((b) =>
                            newStopOnlyBuses.includes(b),
                          );
                          if (allExist) {
                            setNewStopOnlyBuses(
                              newStopOnlyBuses.filter(
                                (b) => !limitedGroup.includes(b),
                              ),
                            );
                          } else {
                            setNewStopOnlyBuses(
                              Array.from(
                                new Set([...newStopOnlyBuses, ...limitedGroup]),
                              ),
                            );
                          }
                        }}
                        className={cn(
                          "py-2 px-3 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all text-center",
                          ["200A", "201B", "202C"].every((b) =>
                            newStopOnlyBuses.includes(b),
                          )
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                            : "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-100",
                        )}
                      >
                        LIMITED (200A, 201B, 202C)
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block ml-1">
                      Quick Select Buses (Click to select)
                    </span>
                    <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 rounded-2xl border border-slate-100">
                      {DEFAULT_QUICK_BUSES.map((code) => {
                        const isSelected = newStopOnlyBuses.includes(code);
                        return (
                          <button
                            key={code}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setNewStopOnlyBuses(
                                  newStopOnlyBuses.filter((item) => item !== code),
                                );
                              } else {
                                setNewStopOnlyBuses([...newStopOnlyBuses, code]);
                              }
                            }}
                            className={cn(
                              "px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all",
                              isSelected
                                ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                                : "bg-white text-slate-600 border-slate-200 hover:border-slate-300",
                            )}
                          >
                            {code}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {buses.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block ml-1">
                        Database Bus Units (Click to select)
                      </span>
                      <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 rounded-2xl border border-slate-100 max-h-24 overflow-y-auto">
                        {buses.map((b) => {
                          const code = b.unitNumber || b.busNumber;
                          const isSelected = newStopOnlyBuses.includes(code);
                          return (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setNewStopOnlyBuses(
                                    newStopOnlyBuses.filter(
                                      (item) => item !== code,
                                    ),
                                  );
                                } else {
                                  setNewStopOnlyBuses([
                                    ...newStopOnlyBuses,
                                    code,
                                  ]);
                                }
                              }}
                              className={cn(
                                "px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all",
                                isSelected
                                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300",
                              )}
                            >
                              {code}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-2">
                    {newStopOnlyBuses.map((bus) => (
                      <span
                        key={bus}
                        className="inline-flex items-center space-x-1 px-3 py-1 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl text-[10px] font-black uppercase tracking-wider"
                      >
                        <span>{bus}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setNewStopOnlyBuses(
                              newStopOnlyBuses.filter((b) => b !== bus),
                            )
                          }
                          className="text-indigo-400 hover:text-indigo-900 font-bold ml-1 text-xs"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                    {newStopOnlyBuses.length === 0 && (
                      <span className="text-[10px] text-slate-400 italic ml-1">
                        All buses stop here by default
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-6">
                <button
                  type="submit"
                  className="w-full py-5 bg-indigo-600 hover:bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100 transition-all active:scale-95 flex items-center justify-center space-x-3"
                >
                  <Check className="w-4 h-4" />
                  <span>Establish Node</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Stop Modal */}
      {isAdmin && isEditingStop && editingStop && (
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
                      value={editingStop.stopNumber}
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
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    Only These Buses Stop
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. 100B, 201B, 305A"
                      className="flex-1 px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-600 text-slate-900 text-xs font-black uppercase tracking-widest"
                      value={editingStopCustomBus}
                      onChange={(e) => setEditingStopCustomBus(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (
                            editingStopCustomBus.trim() &&
                            !editingStopOnlyBuses.includes(
                              editingStopCustomBus.trim(),
                            )
                          ) {
                            setEditingStopOnlyBuses([
                              ...editingStopOnlyBuses,
                              editingStopCustomBus.trim(),
                            ]);
                            setEditingStopCustomBus("");
                          }
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          editingStopCustomBus.trim() &&
                          !editingStopOnlyBuses.includes(
                            editingStopCustomBus.trim(),
                          )
                        ) {
                          setEditingStopOnlyBuses([
                            ...editingStopOnlyBuses,
                            editingStopCustomBus.trim(),
                          ]);
                          setEditingStopCustomBus("");
                        }
                      }}
                      className="px-6 py-4 bg-indigo-600 hover:bg-slate-950 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all font-mono"
                    >
                      Add
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block ml-1">
                      Quick Group Presets
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const allExist = DEFAULT_QUICK_BUSES.every((b) =>
                            editingStopOnlyBuses.includes(b),
                          );
                          if (allExist) {
                            setEditingStopOnlyBuses(
                              editingStopOnlyBuses.filter(
                                (b) => !DEFAULT_QUICK_BUSES.includes(b),
                              ),
                            );
                          } else {
                            setEditingStopOnlyBuses(
                              Array.from(
                                new Set([...editingStopOnlyBuses, ...DEFAULT_QUICK_BUSES]),
                              ),
                            );
                          }
                        }}
                        className={cn(
                          "py-2 px-3 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all text-center",
                          DEFAULT_QUICK_BUSES.every((b) =>
                            editingStopOnlyBuses.includes(b),
                          )
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                            : "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-100",
                        )}
                      >
                        ALL ({DEFAULT_QUICK_BUSES.join(", ")})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const limitedGroup = ["200A", "201B", "202C"];
                          const allExist = limitedGroup.every((b) =>
                            editingStopOnlyBuses.includes(b),
                          );
                          if (allExist) {
                            setEditingStopOnlyBuses(
                              editingStopOnlyBuses.filter(
                                (b) => !limitedGroup.includes(b),
                              ),
                            );
                          } else {
                            setEditingStopOnlyBuses(
                              Array.from(
                                new Set([...editingStopOnlyBuses, ...limitedGroup]),
                              ),
                            );
                          }
                        }}
                        className={cn(
                          "py-2 px-3 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all text-center",
                          ["200A", "201B", "202C"].every((b) =>
                            editingStopOnlyBuses.includes(b),
                          )
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                            : "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-100",
                        )}
                      >
                        LIMITED (200A, 201B, 202C)
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block ml-1">
                      Quick Select Buses (Click to select)
                    </span>
                    <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 rounded-2xl border border-slate-100">
                      {DEFAULT_QUICK_BUSES.map((code) => {
                        const isSelected = editingStopOnlyBuses.includes(code);
                        return (
                          <button
                            key={code}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setEditingStopOnlyBuses(
                                  editingStopOnlyBuses.filter((item) => item !== code),
                                );
                              } else {
                                setEditingStopOnlyBuses([...editingStopOnlyBuses, code]);
                              }
                            }}
                            className={cn(
                              "px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all",
                              isSelected
                                ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                                : "bg-white text-slate-600 border-slate-200 hover:border-slate-300",
                            )}
                          >
                            {code}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {buses.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block ml-1">
                        Database Bus Units (Click to select)
                      </span>
                      <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 rounded-2xl border border-slate-100 max-h-24 overflow-y-auto">
                        {buses.map((b) => {
                          const code = b.unitNumber || b.busNumber;
                          const isSelected =
                            editingStopOnlyBuses.includes(code);
                          return (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setEditingStopOnlyBuses(
                                    editingStopOnlyBuses.filter(
                                      (item) => item !== code,
                                    ),
                                  );
                                } else {
                                  setEditingStopOnlyBuses([
                                    ...editingStopOnlyBuses,
                                    code,
                                  ]);
                                }
                              }}
                              className={cn(
                                "px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all",
                                isSelected
                                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300",
                              )}
                            >
                              {code}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-2">
                    {editingStopOnlyBuses.map((bus) => (
                      <span
                        key={bus}
                        className="inline-flex items-center space-x-1 px-3 py-1 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl text-[10px] font-black uppercase tracking-wider"
                      >
                        <span>{bus}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setEditingStopOnlyBuses(
                              editingStopOnlyBuses.filter((b) => b !== bus),
                            )
                          }
                          className="text-indigo-400 hover:text-indigo-900 font-bold ml-1 text-xs"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                    {editingStopOnlyBuses.length === 0 && (
                      <span className="text-[10px] text-slate-400 italic ml-1">
                        All buses stop here by default
                      </span>
                    )}
                  </div>
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
    </div>
  );
};

interface SortableStopItemProps {
  stop: Stop;
  index: number;
  isAdmin: boolean;
  isStaff: boolean;
  onEdit: (s: Stop) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: Stop["status"]) => void;
}

const SortableStopItem: React.FC<SortableStopItemProps> = ({
  stop,
  index,
  isAdmin,
  isStaff,
  onEdit,
  onDelete,
  onUpdateStatus,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stop.id, disabled: !isAdmin });

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
        "p-6 bg-white rounded-[2rem] border border-slate-100 flex flex-col shadow-sm group hover:border-indigo-500 transition-all",
        isDragging && "shadow-xl border-indigo-500 ring-2 ring-indigo-100 z-50",
      )}
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100 shadow-inner overflow-hidden">
            {isAdmin ? (
              <div
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing p-2 text-slate-300 hover:text-indigo-600 transition-colors"
              >
                <GripVertical className="w-6 h-6" />
              </div>
            ) : (
              <MapPin className="w-6 h-6 text-indigo-600" />
            )}
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight leading-none mb-1.5">
              {stop.name}
            </h4>
            <div className="flex items-center space-x-2">
              <span className="text-[8px] font-black bg-indigo-50 text-indigo-400 px-2 py-0.5 rounded uppercase tracking-widest border border-indigo-100/50">
                NODE #{stop.stopNumber || "N/A"}
              </span>
              {isAdmin && (
                <span className="text-[9px] text-slate-300 font-mono italic uppercase">
                  {stop.id.slice(0, 6)}
                </span>
              )}
            </div>
          </div>
        </div>

        {isAdmin && (
          <div className="flex space-x-1">
            <button
              onClick={() => onEdit(stop)}
              className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
              title="Edit Node"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(stop.id)}
              className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
              title="Purge Node"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <div className="mt-auto pt-6 border-t border-slate-50 flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">
              Status Protocol
            </span>
            <span
              className={cn(
                "text-[9px] font-black uppercase tracking-tighter transition-colors",
                stop.status === "active" || !stop.status
                  ? "text-emerald-600"
                  : stop.status === "inactive"
                    ? "text-red-600"
                    : "text-blue-600",
              )}
            >
              {stop.status || "Active"}
            </span>
          </div>
          {stop.mapUrl && (
            <a
              href={stop.mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-slate-50 hover:bg-indigo-600 text-slate-400 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ring-1 ring-slate-100"
            >
              Geo-Link 📍
            </a>
          )}
        </div>

        {stop.onlyTheseBuses && stop.onlyTheseBuses.length > 0 && (
          <div className="flex flex-col space-y-1 pt-1 border-t border-slate-50/50">
            <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">
              Only These Buses Stop
            </span>
            <div className="flex flex-wrap gap-1">
              {stop.onlyTheseBuses.map((bus) => (
                <span
                  key={bus}
                  className="px-2 py-0.5 bg-indigo-50 border border-indigo-100/50 text-indigo-600 rounded-lg text-[8px] font-black uppercase tracking-wider font-mono"
                >
                  {bus}
                </span>
              ))}
            </div>
          </div>
        )}

        {isStaff && (
          <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100 space-x-1">
            <button
              onClick={() => onUpdateStatus(stop.id, "active")}
              className={cn(
                "flex-1 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all",
                stop.status === "active" || !stop.status
                  ? "bg-emerald-500 text-white shadow-sm"
                  : "text-slate-400 hover:text-emerald-600 hover:bg-white",
              )}
            >
              Active
            </button>
            <button
              onClick={() => onUpdateStatus(stop.id, "inactive")}
              className={cn(
                "flex-1 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all",
                stop.status === "inactive"
                  ? "bg-red-500 text-white shadow-sm"
                  : "text-slate-400 hover:text-red-600 hover:bg-white",
              )}
            >
              Inactive
            </button>
            <button
              onClick={() => onUpdateStatus(stop.id, "maintenance")}
              className={cn(
                "flex-1 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all",
                stop.status === "maintenance"
                  ? "bg-blue-500 text-white shadow-sm"
                  : "text-slate-400 hover:text-blue-600 hover:bg-white",
              )}
            >
              Other
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
