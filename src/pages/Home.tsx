/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
  addDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/AuthContext";
import { logActivity } from "../lib/activityLogger";
import { seedDatabase } from "../lib/seeding";
import { Route as BusRoute, Schedule, Trip, Stop, Bus as BusType } from "../types";
import {
  Clock,
  MapPin,
  Search,
  ChevronRight,
  ArrowRight,
  Bus,
  Calendar,
  Landmark,
  Armchair,
  Database,
  AlertTriangle,
  Sparkles,
  Loader,
} from "lucide-react";
import { cn } from "../lib/utils";
import { BRAND_NAME, BRAND_TAGLINE } from "../constants";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useScroll, useTransform } from "motion/react";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

export const Home = () => {
  const containerRef = useRef(null);
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const busX = useTransform(scrollYProgress, [0, 0.3], ["-100%", "200%"]);
  const busOpacity = useTransform(
    scrollYProgress,
    [0, 0.05, 0.25, 0.3],
    [0, 1, 1, 0],
  );

  const [routes, setRoutes] = useState<BusRoute[]>([]);
  const [buses, setBuses] = useState<BusType[]>([]);
  const [stops, setStops] = useState<Stop[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [searchFrom, setSearchFrom] = useState("");
  const [searchTo, setSearchTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);

  const handleSeed = async () => {
    if (!profile) {
      alert(
        "Please sign in first. Your user role determines your administrative capability.",
      );
      navigate("/login");
      return;
    }

    if (profile.role !== "admin" && profile.role !== "red_admin") {
      alert(
        "Access Denied: Seeding is restricted to system administrators. Note that since you are the first user of the application, your logged in Google account automatically receives Administrator privileges. Please sign out and sign back in to apply this role.",
      );
      return;
    }

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
        "Chigari BRTS database successfully initialized with 4 major routes, live GPS vehicle signals, 6 smart stations, active alerts, and 30+ scheduled passenger trips! You are ready to search, book seats, track, and send alerts!",
      );
    } catch (e: any) {
      console.error(e);
      setSeedError(e.message || "E_SEED_FAILED");
    } finally {
      setIsSeeding(false);
    }
  };

  useEffect(() => {
    const qRoutes = query(collection(db, "routes"));
    const unsubscribeRoutes = onSnapshot(qRoutes, (snapshot) => {
      const routesData = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as BusRoute,
      );
      // Sort numerically
      const sorted = routesData.sort((a, b) => {
        const numA = parseInt(a.name.match(/\d+/)?.[0] || "0");
        const numB = parseInt(b.name.match(/\d+/)?.[0] || "0");
        return numA - numB;
      });
      setRoutes(sorted);
    });

    const qStops = query(collection(db, "stops"));
    const unsubscribeStops = onSnapshot(qStops, (snapshot) => {
      const stopsData = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as Stop,
      );
      setStops(stopsData.sort((a, b) => a.name.localeCompare(b.name)));
    });

    const qBuses = query(collection(db, "buses"));
    const unsubscribeBuses = onSnapshot(qBuses, (snapshot) => {
      setBuses(
        snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as BusType),
      );
    });

    // We set loading false once we have routes
    const unsubscribeRoutesLoad = onSnapshot(qRoutes, () => {
      setLoading(false);
    });

    return () => {
      unsubscribeRoutes();
      unsubscribeStops();
      unsubscribeBuses();
      unsubscribeRoutesLoad();
    };
  }, []);

  const handleSearch = () => {
    setLoading(true);
    setHasSearched(true);

    if (profile) {
      logActivity(
        profile,
        "SEARCH_ROUTE",
        `User searched transit options from '${searchFrom || "Any"}' to '${searchTo || "Any"}'`,
      );
    } else {
      logActivity(
        null,
        "SEARCH_ROUTE",
        `Guest user searched transit options from '${searchFrom || "Any"}' to '${searchTo || "Any"}'`,
        { uid: "guest", email: "guest@chigari.brts", role: "passenger" },
      );
    }

    const qTrips = query(collection(db, "trips"));
    const unsubscribeTrips = onSnapshot(qTrips, (snapshot) => {
      const allTrips = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as Trip,
      );

      const filtered = allTrips.filter((trip) => {
        const route = routes.find((r) => r.id === trip.routeId);
        if (!route) return false;

        const matchesFrom =
          searchFrom === "" ||
          route.origin.toLowerCase().includes(searchFrom.toLowerCase()) ||
          searchFrom.toLowerCase().includes(route.origin.toLowerCase());
        const matchesTo =
          searchTo === "" ||
          route.destination.toLowerCase().includes(searchTo.toLowerCase()) ||
          searchTo.toLowerCase().includes(route.destination.toLowerCase());

        if (!matchesFrom || !matchesTo) return false;

        // "Only These Buses Stop" filter matching:
        const bus = buses.find((b) => b.id === trip.busId);
        if (bus) {
          const busCode = bus.unitNumber || bus.busNumber;

          const originStop = stops.find(
            (s) => s.name.toLowerCase() === searchFrom.toLowerCase(),
          );
          if (
            originStop &&
            originStop.onlyTheseBuses &&
            originStop.onlyTheseBuses.length > 0
          ) {
            if (!originStop.onlyTheseBuses.includes(busCode)) {
              return false;
            }
          }

          const destStop = stops.find(
            (s) => s.name.toLowerCase() === searchTo.toLowerCase(),
          );
          if (
            destStop &&
            destStop.onlyTheseBuses &&
            destStop.onlyTheseBuses.length > 0
          ) {
            if (!destStop.onlyTheseBuses.includes(busCode)) {
              return false;
            }
          }
        }

        return true;
      });

      setTrips(filtered);
      setLoading(false);
    });

    return () => unsubscribeTrips();
  };

  const inspectRouteSchedule = (origin: string, destination: string) => {
    setSearchFrom(origin);
    setSearchTo(destination);
    setHasSearched(true);
    setLoading(true);

    const qTrips = query(collection(db, "trips"));
    const unsubscribeTrips = onSnapshot(qTrips, (snapshot) => {
      const allTrips = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as Trip,
      );

      const filtered = allTrips.filter((trip) => {
        const route = routes.find((r) => r.id === trip.routeId);
        if (!route) return false;

        const matchesFrom =
          route.origin.toLowerCase().includes(origin.toLowerCase()) ||
          origin.toLowerCase().includes(route.origin.toLowerCase());
        const matchesTo =
          route.destination.toLowerCase().includes(destination.toLowerCase()) ||
          destination.toLowerCase().includes(route.destination.toLowerCase());

        if (!matchesFrom || !matchesTo) return false;

        // "Only These Buses Stop" filter matching:
        const bus = buses.find((b) => b.id === trip.busId);
        if (bus) {
          const busCode = bus.unitNumber || bus.busNumber;

          const originStop = stops.find(
            (s) => s.name.toLowerCase() === origin.toLowerCase(),
          );
          if (
            originStop &&
            originStop.onlyTheseBuses &&
            originStop.onlyTheseBuses.length > 0
          ) {
            if (!originStop.onlyTheseBuses.includes(busCode)) {
              return false;
            }
          }

          const destStop = stops.find(
            (s) => s.name.toLowerCase() === destination.toLowerCase(),
          );
          if (
            destStop &&
            destStop.onlyTheseBuses &&
            destStop.onlyTheseBuses.length > 0
          ) {
            if (!destStop.onlyTheseBuses.includes(busCode)) {
              return false;
            }
          }
        }

        return true;
      });

      setTrips(filtered);
      setLoading(false);
    });

    // Scroll to results section smoothly
    setTimeout(() => {
      document
        .getElementById("results-section")
        ?.scrollIntoView({ behavior: "smooth" });
    }, 120);
  };

  const [isBookingSeat, setIsBookingSeat] = useState<Trip | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<number[]>([]);

  const uniqueOrigins = Array.from(new Set(stops.map((s) => s.name))).sort();
  const uniqueDestinations = Array.from(
    new Set(stops.map((s) => s.name)),
  ).sort();

  const handleSwap = () => {
    const temp = searchFrom;
    setSearchFrom(searchTo);
    setSearchTo(temp);
    setIsSwapping((prev) => !prev);
  };

  const handleBooking = async () => {
    if (!isBookingSeat || selectedSeats.length === 0) return;

    if (!user) {
      alert(
        "AUTHENTICATION REQUIRED. Please sign in to book your transit tickets.",
      );
      return;
    }

    // Create booking
    try {
      const bookingData = {
        tripId: isBookingSeat.id,
        userId: user.uid,
        seatNumbers: selectedSeats,
        totalAmount: selectedSeats.length * isBookingSeat.price,
        status: "confirmed",
        createdAt: new Date().toISOString(),
      };

      await addDoc(collection(db, "bookings"), bookingData);
      await logActivity(
        profile,
        "BOOK_SEAT",
        `Booked seats [${selectedSeats.join(", ")}] on Trip ID '${isBookingSeat.id}' for total ₹${bookingData.totalAmount}`,
      );

      // Update trip available seats (simplified)
      // await updateDoc(doc(db, 'trips', isBookingSeat.id), {
      //   availableSeats: isBookingSeat.availableSeats - selectedSeats.length,
      //   bookedSeats: [...isBookingSeat.bookedSeats, ...selectedSeats]
      // });

      alert(
        "RESERVATION CONFIRMED. Ticket ID: TR-" +
          Math.random().toString(36).substring(7).toUpperCase(),
      );
      setIsBookingSeat(null);
      setSelectedSeats([]);
    } catch (e) {
      console.error(e);
    }
  };

  const toggleSeat = (seatNum: number) => {
    if (selectedSeats.includes(seatNum)) {
      setSelectedSeats(selectedSeats.filter((s) => s !== seatNum));
    } else {
      setSelectedSeats([...selectedSeats, seatNum]);
    }
  };

  return (
    <div ref={containerRef} className="space-y-12 pb-24 relative">
      {/* Seat Selection Modal */}
      <AnimatePresence>
        {isBookingSeat && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
              onClick={() => setIsBookingSeat(null)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative bg-white w-full max-w-2xl rounded-[3rem] overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">
                    Seat Selection
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                    Trip ID: {isBookingSeat.id.slice(0, 8).toUpperCase()}
                  </p>
                </div>
                <button
                  onClick={() => setIsBookingSeat(null)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <ChevronRight className="w-6 h-6 rotate-180" />
                </button>
              </div>

              <div className="p-10 flex flex-col md:flex-row gap-12">
                {/* Seat Map */}
                <div className="flex-1 space-y-8">
                  <div className="relative p-6 bg-slate-50 rounded-3xl border border-slate-200">
                    <div className="absolute top-4 right-4 text-[9px] font-black text-slate-300 uppercase tracking-widest">
                      Front / Steering
                    </div>

                    <div className="grid grid-cols-4 gap-3 pt-8 pb-4">
                      {Array.from({ length: 20 }).map((_, i) => {
                        const seatNum = i + 1;
                        const isBooked =
                          isBookingSeat.bookedSeats?.includes(seatNum);
                        const isSelected = selectedSeats.includes(seatNum);

                        return (
                          <button
                            key={seatNum}
                            disabled={isBooked}
                            onClick={() => toggleSeat(seatNum)}
                            className={cn(
                              "w-full aspect-square rounded-xl flex items-center justify-center text-[10px] font-black tracking-tight transition-all",
                              isBooked
                                ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                                : isSelected
                                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
                                  : "bg-white border border-slate-200 hover:border-indigo-400 text-slate-600 hover:text-indigo-600",
                            )}
                          >
                            {seatNum}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center justify-center space-x-6">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded bg-white border border-slate-200" />
                      <span className="text-[9px] font-black uppercase text-slate-400">
                        Available
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded bg-indigo-600" />
                      <span className="text-[9px] font-black uppercase text-indigo-600">
                        Selected
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded bg-slate-200" />
                      <span className="text-[9px] font-black uppercase text-slate-400">
                        Booked
                      </span>
                    </div>
                  </div>
                </div>

                {/* Price Breakdown */}
                <div className="w-full md:w-64 space-y-8">
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-2">
                      Booking Summary
                    </h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400 font-bold uppercase">
                          Seats
                        </span>
                        <span className="font-black text-slate-900">
                          {selectedSeats.length > 0
                            ? selectedSeats.join(", ")
                            : "None"}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400 font-bold uppercase">
                          Base Fare
                        </span>
                        <span className="font-black text-slate-900">
                          ₹{isBookingSeat.price} × {selectedSeats.length}
                        </span>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex justify-between items-end">
                      <span className="text-xs font-black text-slate-400 uppercase leading-none">
                        Total Payable
                      </span>
                      <span className="text-3xl font-black text-indigo-600 tracking-tighter leading-none">
                        ₹{selectedSeats.length * isBookingSeat.price}
                      </span>
                    </div>
                  </div>

                  <button
                    disabled={selectedSeats.length === 0}
                    onClick={handleSearch} // Just calling search for UI feedback for now, we'll implement real booking
                    className="w-full py-5 bg-indigo-600 hover:bg-slate-900 disabled:bg-slate-200 disabled:cursor-not-allowed text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100 transition-all active:scale-95"
                    onClickCapture={handleBooking}
                  >
                    Confirm Reservation
                  </button>

                  <p className="text-[8px] text-slate-400 font-medium leading-relaxed italic text-center">
                    By clicking confirm, you agree to Chigari's transit
                    protocols and reservation policy.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* VRL Style Hero & Search Widget */}
      <section className="relative -mx-6 px-6 pt-12 pb-24 bg-indigo-950 overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full opacity-10 pointer-events-none">
          <Bus className="w-[800px] h-[800px] text-white rotate-12 -mr-32 -mt-32" />
        </div>

        <div className="relative z-10 flex items-center justify-center min-h-[400px] overflow-hidden">
          <motion.div
            style={{ x: busX, opacity: busOpacity }}
            className="w-full max-w-4xl"
          >
            <img
              src="/input_file_0.png"
              alt="Chigari Premium Bus"
              className="w-full h-auto drop-shadow-[0_35px_35px_rgba(0,0,0,0.5)]"
              referrerPolicy="no-referrer"
            />
          </motion.div>

          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="bg-indigo-950/60 backdrop-blur-md px-10 py-8 rounded-[2rem] border border-white/15 max-w-2xl shadow-2xl"
            >
              <h1 className="text-xl md:text-2xl lg:text-3xl font-black text-white tracking-wider uppercase mb-2 drop-shadow-sm leading-tight">
                HUBBALLI-DHARWAD BUS RAPID TRANSIT SYSTEM
              </h1>
              <div className="w-12 h-1 bg-indigo-500 mx-auto my-3 rounded-full opacity-60"></div>
              <h2 className="text-xs md:text-sm font-black text-indigo-300 tracking-[0.35em] uppercase italic opacity-70">
                Smooth Transit
              </h2>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Floating Interactive Search Widget */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative -mt-20 z-30 max-w-4xl mx-auto px-4"
      >
        <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] border border-slate-200 shadow-2xl shadow-indigo-950/5">
          {/* Seeding Setup Assistant Banner */}
          {routes.length === 0 && !loading && (
            <div className="mb-8 p-6 bg-amber-50/50 border border-amber-200/60 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-start space-x-4">
                <div className="bg-amber-100 p-3 rounded-2xl text-amber-600 shrink-0">
                  <Database className="w-5 h-5 animate-bounce" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-black uppercase tracking-wider text-amber-900 flex items-center gap-2">
                    <span>Transit Register Offline</span>
                    <span className="px-2 py-0.5 text-[8px] font-black bg-amber-500 text-white rounded-full leading-none tracking-widest">
                      SETUP ASSISTANT
                    </span>
                  </h4>
                  <p className="text-[10px] font-bold text-amber-800/80 uppercase leading-relaxed max-w-xl">
                    No active routes or stations are initialized in your
                    workspace database. Authenticate with a Google account to
                    become the system administrator and click below to populate
                    mock BRTS data instantly.
                  </p>
                  {seedError && (
                    <p className="text-[10px] font-bold text-red-600 uppercase">
                      Error: {seedError}
                    </p>
                  )}
                </div>
              </div>
              <div className="shrink-0 w-full md:w-auto">
                {profile ? (
                  <button
                    disabled={isSeeding}
                    onClick={handleSeed}
                    className="w-full px-6 py-4 bg-amber-600 hover:bg-slate-900 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-amber-200 flex items-center justify-center space-x-2 cursor-pointer transition-all disabled:opacity-50"
                  >
                    {isSeeding ? (
                      <>
                        <Loader className="w-4 h-4 animate-spin" />
                        <span>Initializing System...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 fill-current" />
                        <span>Initialize BRTS Database</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      alert(
                        "You are being redirected to our Authorization handshaker portal. Please authorize any Google Account to receive Administrator permissions.",
                      );
                      navigate("/login");
                    }}
                    className="w-full px-6 py-4 bg-slate-900 hover:bg-indigo-600 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-lg flex items-center justify-center space-x-2 cursor-pointer transition-all"
                  >
                    <span>Authenticate & Launch Setup</span>
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            {/* Origin Station */}
            <div className="md:col-span-5 space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">
                Origin Station
              </label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500 pointer-events-none" />
                <select
                  value={searchFrom}
                  onChange={(e) => setSearchFrom(e.target.value)}
                  className="w-full pl-11 pr-8 py-4 rounded-2xl bg-slate-50 border border-slate-200/60 focus:ring-2 focus:ring-indigo-600 focus:bg-white text-slate-800 text-xs font-black uppercase tracking-wider appearance-none cursor-pointer transition-all"
                >
                  <option value="">All Locations</option>
                  {uniqueOrigins.map((origin) => (
                    <option key={origin} value={origin}>
                      {origin}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Swap Directions button (Micro-interaction) */}
            <div className="md:col-span-2 flex justify-center pb-1">
              <motion.button
                type="button"
                onClick={handleSwap}
                whileHover={{ scale: 1.1, backgroundColor: "#f1f5f9" }}
                whileTap={{ scale: 0.95 }}
                className="w-11 h-11 rounded-2xl bg-slate-50 border border-slate-200/60 flex items-center justify-center text-indigo-600 shadow-sm cursor-pointer transition-colors"
                title="Swap Destinations"
              >
                <motion.div
                  animate={{ rotate: isSwapping ? 180 : 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="flex items-center justify-center"
                >
                  <ArrowRight className="w-4 h-4 text-indigo-500" />
                </motion.div>
              </motion.button>
            </div>

            {/* Target Destination */}
            <div className="md:col-span-5 space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">
                Destination Station
              </label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500 pointer-events-none" />
                <select
                  value={searchTo}
                  onChange={(e) => setSearchTo(e.target.value)}
                  className="w-full pl-11 pr-8 py-4 rounded-2xl bg-slate-50 border border-slate-200/60 focus:ring-2 focus:ring-indigo-600 focus:bg-white text-slate-800 text-xs font-black uppercase tracking-wider appearance-none cursor-pointer transition-all"
                >
                  <option value="">All Destinations</option>
                  {uniqueDestinations.map((dest) => (
                    <option key={dest} value={dest}>
                      {dest}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-2 text-slate-400">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] font-black uppercase tracking-[0.2em]">
                Operational Dispatch Online
              </span>
            </div>

            <motion.button
              onClick={() => {
                handleSearch();
                // Scroll smoothly
                setTimeout(() => {
                  document
                    .getElementById("results-section")
                    ?.scrollIntoView({ behavior: "smooth" });
                }, 100);
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full sm:w-auto px-8 py-4 bg-indigo-600 hover:bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100 flex items-center justify-center space-x-2 cursor-pointer transition-all"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Search Transit Options</span>
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Results Section */}
      <section id="results-section" className="max-w-6xl mx-auto pt-8">
        <div className="flex items-center justify-between mb-10">
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
              {hasSearched ? "Search Results" : "Premium Express Routes"}
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em]">
              Operational Readiness Status: Green
            </p>
          </div>
          {hasSearched && (
            <button
              onClick={() => {
                setHasSearched(false);
                setTrips([]);
              }}
              className="text-[9px] font-black text-indigo-600 uppercase tracking-widest hover:underline"
            >
              Reset Terminal
            </button>
          )}
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-6 w-full animate-in fade-in duration-300"
        >
          {/* Listings */}
          <div className="space-y-4 w-full">
            {(() => {
              if (!hasSearched || !searchFrom || !searchTo) return null;

              const originStop = stops.find(
                (s) => s.name.toLowerCase() === searchFrom.toLowerCase()
              );
              const destStop = stops.find(
                (s) => s.name.toLowerCase() === searchTo.toLowerCase()
              );

              const allBusCodes = buses
                .map((b) => b.unitNumber || b.busNumber)
                .filter(Boolean) as string[];

              const originBuses =
                originStop &&
                originStop.onlyTheseBuses &&
                originStop.onlyTheseBuses.length > 0
                  ? originStop.onlyTheseBuses
                  : allBusCodes;

              const destBuses =
                destStop &&
                destStop.onlyTheseBuses &&
                destStop.onlyTheseBuses.length > 0
                  ? destStop.onlyTheseBuses
                  : allBusCodes;

              const servingBuses = originBuses.filter((b) =>
                destBuses.includes(b)
              );

              // Compute Multi-Bus Intelligent Transfer suggestions if no direct bus is found
              const transfers = (() => {
                if (!originStop || !destStop) return [];
                const options: {
                  intermediateStop: Stop;
                  firstBuses: string[];
                  secondBuses: string[];
                }[] = [];

                for (const stop of stops) {
                  // Do not use origin or destination as transfer stop
                  if (
                    stop.name.toLowerCase() === originStop.name.toLowerCase() ||
                    stop.name.toLowerCase() === destStop.name.toLowerCase()
                  )
                    continue;

                  const stopBuses =
                    stop.onlyTheseBuses && stop.onlyTheseBuses.length > 0
                      ? stop.onlyTheseBuses
                      : allBusCodes;

                  const firstLegBuses = originBuses.filter((b) =>
                    stopBuses.includes(b)
                  );
                  const secondLegBuses = stopBuses.filter((b) =>
                    destBuses.includes(b)
                  );

                  if (firstLegBuses.length > 0 && secondLegBuses.length > 0) {
                    options.push({
                      intermediateStop: stop,
                      firstBuses: firstLegBuses,
                      secondBuses: secondLegBuses,
                    });
                  }
                }
                return options;
              })();

              const bestTransfer = transfers[0];

              return (
                <div className="mb-6 w-full">
                  {servingBuses.length === 0 ? (
                    bestTransfer ? (
                      <div className="mb-6 p-8 rounded-[2.5rem] border-2 border-indigo-100 transition-all shadow-xl bg-white flex flex-col md:flex-row items-start gap-6 animate-in slide-in-from-bottom-3 duration-300 w-full">
                        <div className="bg-indigo-50 p-4 rounded-3xl text-indigo-600 shrink-0 border border-indigo-100/60 shadow-inner flex items-center justify-center self-center md:self-start">
                          <ArrowRight className="w-10 h-10 text-indigo-600 transform rotate-45" />
                        </div>
                        <div className="space-y-4 text-left flex-1 w-full">
                          <div className="space-y-1.5">
                            <span className="inline-flex items-center px-3 py-1 bg-indigo-50 text-[10px] font-black text-indigo-700 rounded-full border border-indigo-100 uppercase tracking-widest animate-pulse">
                              Intelligent Multi-Bus Transfer Suggestion
                            </span>
                            <h3 className="text-xl md:text-2xl font-black text-indigo-950 tracking-tight leading-tight uppercase">
                              No direct bus found, but you can transfer at <span className="text-indigo-600 underline decoration-indigo-300 decoration-wavy decoration-2 font-black">{bestTransfer.intermediateStop.name}</span>!
                            </h3>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                              Transit Connection Matrix: {searchFrom} ➔ {bestTransfer.intermediateStop.name} ➔ {searchTo}
                            </p>
                          </div>

                          {/* Step-by-Step Instructions */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 w-full">
                            {/* Step 1 */}
                            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-150 relative overflow-hidden group">
                              <div className="absolute top-2 right-2 text-3xl font-black text-slate-200/50 select-none">1</div>
                              <span className="text-[9px] font-black uppercase text-indigo-600 tracking-widest block mb-1">Board first bus</span>
                              <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">Origin Departure</h4>
                              <p className="text-xs text-slate-500 font-bold leading-relaxed mt-1.5">
                                Board <span className="font-extrabold text-indigo-600">Bus No. {bestTransfer.firstBuses.join(" or ")}</span> from <span className="font-bold text-slate-700">{searchFrom}</span>.
                              </p>
                            </div>

                            {/* Step 2 */}
                            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-150 relative overflow-hidden group">
                              <div className="absolute top-2 right-2 text-3xl font-black text-slate-200/50 select-none">2</div>
                              <span className="text-[9px] font-black uppercase text-indigo-600 tracking-widest block mb-1">Transfer Point</span>
                              <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">Switching Junction</h4>
                              <p className="text-xs text-slate-500 font-bold leading-relaxed mt-1.5">
                                Get off at <span className="font-black text-indigo-700 underline decoration-indigo-200 decoration-2">{bestTransfer.intermediateStop.name}</span>.
                              </p>
                            </div>

                            {/* Step 3 */}
                            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-150 relative overflow-hidden group">
                              <div className="absolute top-2 right-2 text-3xl font-black text-slate-200/50 select-none">3</div>
                              <span className="text-[9px] font-black uppercase text-indigo-600 tracking-widest block mb-1">Board second bus</span>
                              <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">Final Destination</h4>
                              <p className="text-xs text-slate-500 font-bold leading-relaxed mt-1.5">
                                Transfer to <span className="font-extrabold text-indigo-600">Bus No. {bestTransfer.secondBuses.join(" or ")}</span> to reach <span className="font-bold text-slate-700">{searchTo}</span>.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mb-6 p-8 rounded-[2.5rem] border-2 border-red-100 transition-all shadow-xl bg-white flex flex-col md:flex-row items-center md:items-start gap-6 animate-in slide-in-from-bottom-3 duration-300 w-full">
                        <div className="bg-red-50 p-4 rounded-3xl text-red-600 shrink-0 border border-red-100 shadow-inner flex items-center justify-center">
                          <AlertTriangle className="w-10 h-10 text-red-600 animate-pulse" />
                        </div>
                        <div className="space-y-3 text-center md:text-left flex-1">
                          <span className="inline-flex items-center px-3 py-1 bg-red-50 text-[10px] font-black text-red-700 rounded-full border border-red-150 uppercase tracking-widest">
                            No Connections Available
                          </span>
                          <h3 className="text-xl md:text-2xl font-black text-red-950 tracking-tight leading-tight uppercase">
                            No direct or transfer buses available for this route!
                          </h3>
                          <p className="text-sm font-medium text-slate-500 leading-relaxed max-w-2xl">
                            Unfortunately, there is no direct bus or intermediate connection stop between <span className="font-bold text-slate-700">{searchFrom}</span> and <span className="font-bold text-slate-700">{searchTo}</span>.
                          </p>
                        </div>
                      </div>
                    )
                  ) : servingBuses.length === 1 ? (
                    <div className="mb-6 p-8 rounded-[2.5rem] border-2 border-indigo-100 transition-all shadow-xl bg-white flex flex-col md:flex-row items-center md:items-start gap-6 animate-in slide-in-from-bottom-3 duration-300 w-full">
                      <div className="bg-indigo-50 p-4 rounded-3xl text-indigo-600 shrink-0 border border-indigo-100/60 shadow-inner flex items-center justify-center">
                        <Sparkles className="w-10 h-10 text-indigo-600 animate-bounce" />
                      </div>
                      <div className="space-y-3 text-center md:text-left flex-1">
                        <span className="inline-flex items-center px-3 py-1 bg-indigo-50 text-[10px] font-black text-indigo-700 rounded-full border border-indigo-100 uppercase tracking-widest">
                          Smart Recommendations
                        </span>
                        <h3 className="text-xl md:text-2xl font-black text-indigo-950 tracking-tight leading-tight uppercase">
                          Hey, {profile?.displayName || "Passenger"}! <br className="hidden md:inline" />
                          Please Board Bus No. <span className="text-indigo-600 underline decoration-indigo-400 decoration-wavy decoration-2 font-black">{servingBuses[0]}</span>.
                        </h3>
                        <p className="text-sm font-medium text-slate-500 leading-relaxed max-w-2xl">
                          Station pair (<span className="font-bold text-slate-700">{searchFrom}</span> ⇄ <span className="font-bold text-slate-700">{searchTo}</span>) is served exclusively by <span className="font-bold text-indigo-700">Bus No. {servingBuses[0]}</span>.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-6 p-8 rounded-[2.5rem] border-2 border-emerald-100 transition-all shadow-xl bg-white flex flex-col md:flex-row items-center md:items-start gap-6 animate-in slide-in-from-bottom-3 duration-300 w-full">
                      <div className="bg-emerald-50 p-4 rounded-3xl text-emerald-600 shrink-0 border border-emerald-100/60 shadow-inner flex items-center justify-center">
                        <Bus className="w-10 h-10 text-emerald-600 animate-pulse" />
                      </div>
                      <div className="space-y-3 text-center md:text-left flex-1 w-full">
                        <span className="inline-flex items-center px-3 py-1 bg-emerald-50 text-[10px] font-black text-emerald-700 rounded-full border border-emerald-100 uppercase tracking-widest">
                          Optimized Transit Pathways
                        </span>
                        <h3 className="text-xl md:text-2xl font-black text-emerald-950 tracking-tight leading-tight uppercase">
                          Hey, {profile?.displayName || "Passenger"}! <br className="hidden md:inline" />
                          Multiple buses serve this path.
                        </h3>
                        <p className="text-lg font-bold text-emerald-700">
                          You can board any of these buses: <span className="underline decoration-emerald-400 decoration-wavy decoration-2 font-black">{servingBuses.join(", ")}</span>.
                        </p>
                        {(() => {
                          const busTrips = servingBuses.map((busCode) => {
                            const busDoc = buses.find(
                              (b) => (b.unitNumber || b.busNumber) === busCode
                            );
                            const tripsForBus = trips.filter(
                              (t) => t.busId === busDoc?.id
                            );

                            const sortedTrips = [...tripsForBus].sort((a, b) => {
                              const parseTime = (tStr: string) => {
                                const [time, modifier] = tStr.split(" ");
                                let [hours, minutes] = time
                                  .split(":")
                                  .map(Number);
                                if (hours === 12) hours = 0;
                                if (modifier === "PM") hours += 12;
                                return hours * 60 + minutes;
                              };
                              return (
                                parseTime(a.departureTime) -
                                parseTime(b.departureTime)
                              );
                            });

                            return {
                              busCode,
                              tripsCount: tripsForBus.length,
                              earliestTrip: sortedTrips[0] || null,
                            };
                          });

                          const sortedBuses = [...busTrips].sort((a, b) => {
                            if (a.earliestTrip && b.earliestTrip) {
                              const parseTime = (tStr: string) => {
                                const [time, modifier] = tStr.split(" ");
                                let [hours, minutes] = time
                                  .split(":")
                                  .map(Number);
                                if (hours === 12) hours = 0;
                                if (modifier === "PM") hours += 12;
                                return hours * 60 + minutes;
                              };
                              return (
                                parseTime(a.earliestTrip.departureTime) -
                                parseTime(b.earliestTrip.departureTime)
                              );
                            }
                            if (a.earliestTrip) return -1;
                            if (b.earliestTrip) return 1;
                            return b.tripsCount - a.tripsCount;
                          });

                          const bestBus = sortedBuses[0];
                          if (bestBus && bestBus.earliestTrip) {
                            return (
                              <div className="mt-3 p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100/50 w-full text-left">
                                <p className="text-xs font-black uppercase text-emerald-800">
                                  ⭐ Recommended: Board Bus No. {bestBus.busCode}
                                </p>
                                <p className="text-[11px] font-bold uppercase text-slate-500 mt-1">
                                  Earliest scheduled departure is at{" "}
                                  {bestBus.earliestTrip.departureTime} with{" "}
                                  {bestBus.earliestTrip.availableSeats} available
                                  seats remaining.
                                </p>
                              </div>
                            );
                          }
                          return (
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1 text-left">
                              Analyze schedule below to choose the most convenient boarding window.
                            </p>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-40 bg-slate-100 animate-pulse rounded-3xl"
                />
              ))
            ) : hasSearched ? (
              trips.length > 0 ? (
                <motion.div layout className="space-y-4">
                  {trips.map((trip) => {
                    const route = routes.find((r) => r.id === trip.routeId);
                    const isRouteActive =
                      route?.status === "active" || !route?.status;
                    return (
                      <motion.div
                        key={trip.id}
                        variants={itemVariants}
                        whileHover={{ y: -5, scale: 1.01 }}
                        className={cn(
                          "bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-indigo-400 transition-all group",
                          !isRouteActive && "opacity-60 grayscale-[0.5]",
                        )}
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                          <div className="flex-1 flex items-center space-x-8">
                            <div className="space-y-1">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                Depart
                              </p>
                              <p className="text-2xl font-black text-slate-900 tracking-tighter">
                                {trip.departureTime}
                              </p>
                              <p className="text-[10px] font-bold text-slate-500 uppercase">
                                {route?.origin}
                              </p>
                            </div>

                            <div className="flex-1 flex flex-col items-center">
                              <div className="w-full flex items-center px-4">
                                <div className="w-2 h-2 rounded-full border-2 border-indigo-600 bg-white" />
                                <div className="flex-1 border-t-2 border-dashed border-slate-200 relative">
                                  <Bus className="absolute left-1/2 top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 text-slate-200 group-hover:text-indigo-400 transition-colors" />
                                </div>
                                <div className="w-2 h-2 rounded-full border-2 border-slate-300 bg-white" />
                              </div>
                              <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mt-2">
                                {trip.status}
                              </p>
                            </div>

                            <div className="space-y-1 text-right">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                Arrive
                              </p>
                              <p className="text-2xl font-black text-slate-900 tracking-tighter">
                                {trip.arrivalTime}
                              </p>
                              <p className="text-[10px] font-bold text-slate-500 uppercase">
                                {route?.destination}
                              </p>
                            </div>
                          </div>

                          <div className="w-full md:w-px md:h-16 bg-slate-100" />

                          <div className="flex items-center md:flex-col md:items-end justify-between md:justify-center md:space-y-2">
                            <div className="text-right">
                              <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest leading-none">
                                Starting from
                              </p>
                              <p className="text-2xl font-black text-slate-900 tracking-tighter">
                                ₹{trip.price}
                              </p>
                            </div>
                            <button
                              onClick={() =>
                                isRouteActive && setIsBookingSeat(trip)
                              }
                              disabled={!isRouteActive}
                              className={cn(
                                "px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                isRouteActive
                                  ? "bg-indigo-600 hover:bg-slate-900 text-white"
                                  : "bg-slate-100 text-slate-400 cursor-not-allowed",
                              )}
                            >
                              {isRouteActive ? "Select Seat" : "Inactive"}
                            </button>
                          </div>
                        </div>

                        <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                              <Armchair size={12} className="text-slate-300" />
                              <span>{trip.availableSeats} Seats Left</span>
                            </div>
                            <div className="flex items-center space-x-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                              <Clock size={12} className="text-slate-300" />
                              <span>CH-{route?.name} Express</span>
                            </div>
                            {route?.status && (
                              <div
                                className={cn(
                                  "text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border transition-colors",
                                  route.status === "active"
                                    ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                                    : route.status === "inactive"
                                      ? "bg-red-50 text-red-600 border-red-100"
                                      : "bg-blue-50 text-blue-600 border-blue-100",
                                )}
                              >
                                {route.status}
                              </div>
                            )}
                          </div>
                          <div className="flex -space-x-2">
                            {Array.from({ length: 3 }).map((_, i) => (
                              <div
                                key={i}
                                className="w-5 h-5 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center overflow-hidden"
                              >
                                <div className="w-full h-full bg-indigo-50" />
                              </div>
                            ))}
                            <div className="w-5 h-5 rounded-full border-2 border-white bg-indigo-600 text-[7px] font-black text-white flex items-center justify-center">
                              +12
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              ) : (
                <div className="py-24 text-center bg-slate-50 rounded-[40px] border-2 border-dashed border-slate-200">
                  <Search className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest">
                    No trips found for the selected parameters
                  </p>
                </div>
              )
            ) : (
              <motion.div layout className="space-y-4">
                {routes
                  .filter((r) => r.status === "active" || !r.status)
                  .map((route) => (
                    <motion.div
                      key={route.id}
                      variants={itemVariants}
                      whileHover={{
                        x: 10,
                        backgroundColor: "rgba(248, 250, 252, 1)",
                      }}
                      className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all group flex flex-col md:flex-row md:items-center justify-between gap-6"
                    >
                      <div className="flex items-center space-x-6">
                        <div
                          className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-black italic italic shadow-xl"
                          style={{ backgroundColor: route.color }}
                        >
                          {route.name[0]}
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-lg font-black text-slate-900 tracking-tight uppercase leading-none italic">
                            Route CH-{route.name}
                          </h3>
                          <div className="flex items-center space-x-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            <span>{route.origin}</span>
                            <span className="text-[10px] text-indigo-500 font-extrabold tracking-tight flex items-center select-none">
                              <span>⇄</span>
                            </span>
                            <span>{route.destination}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSearchFrom(route.origin);
                          setSearchTo(route.destination);
                          setHasSearched(false); // Let user trigger search button
                          document.querySelector("input")?.focus();
                        }}
                        className="px-6 py-3 border border-slate-200 hover:border-indigo-600 hover:bg-slate-50 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                      >
                        Inspect Active Schedule
                      </button>
                    </motion.div>
                  ))}
              </motion.div>
            )}
          </div>
        </motion.div>
      </section>
    </div>
  );
};
