/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { collection, doc, writeBatch, getDocs, limit, query } from 'firebase/firestore';
import { db } from './firebase';
import { Route, Bus, Stop, Trip, Alert, UserProfile } from '../types';
import { logActivity } from './activityLogger';

export async function isDatabaseEmpty(): Promise<boolean> {
  const q = query(collection(db, 'routes'), limit(1));
  const snapshot = await getDocs(q);
  return snapshot.empty;
}

export async function seedDatabase(profile: UserProfile | null) {
  if (!profile) {
    throw new Error('Authentication required. Please sign in as an admin to seed the Hubballi-Dharwad BRTS database.');
  }
  
  if (profile.role !== 'admin' && profile.role !== 'red_admin') {
    throw new Error('Unauthorized. Only administrators are allowed to initialize the system database.');
  }

  const batch = writeBatch(db);

  // --- 1. SEED ROUTES ---
  const routeRefs = [
    doc(collection(db, 'routes')),
    doc(collection(db, 'routes')),
    doc(collection(db, 'routes')),
    doc(collection(db, 'routes'))
  ];

  const routes: Route[] = [
    {
      id: routeRefs[0].id,
      name: '101',
      origin: 'Hubballi CBT',
      destination: 'Dharwad CBT',
      color: '#dc2626',
      order: 1,
      status: 'active'
    },
    {
      id: routeRefs[1].id,
      name: '102',
      origin: 'Unkal Lake',
      destination: 'SDM Hospital',
      color: '#059669',
      order: 2,
      status: 'active'
    },
    {
      id: routeRefs[2].id,
      name: '103',
      origin: 'Rayapur Transit',
      destination: 'Navanagar',
      color: '#4f46e5',
      order: 3,
      status: 'active'
    },
    {
      id: routeRefs[3].id,
      name: '104',
      origin: 'Hubballi Airport',
      destination: 'Hubballi CBT',
      color: '#7c3aed',
      order: 4,
      status: 'active'
    }
  ];

  routes.forEach((route, idx) => {
    batch.set(routeRefs[idx], {
      name: route.name,
      origin: route.origin,
      destination: route.destination,
      color: route.color,
      order: route.order,
      status: route.status
    });
  });

  // --- 2. SEED BUSES ---
  const busRefs = [
    doc(collection(db, 'buses')),
    doc(collection(db, 'buses')),
    doc(collection(db, 'buses')),
    doc(collection(db, 'buses'))
  ];

  const buses: Bus[] = [
    {
      id: busRefs[0].id,
      busNumber: 'KA-25-F-1001',
      unitNumber: 'BRTS-EV-01',
      registrationNumber: 'KA25F1001',
      currentRouteId: routeRefs[0].id,
      status: 'active',
      lastLocation: { lat: 15.4089, lng: 75.0878 },
      updatedAt: new Date().toISOString()
    },
    {
      id: busRefs[1].id,
      busNumber: 'KA-25-F-1002',
      unitNumber: 'BRTS-EV-02',
      registrationNumber: 'KA25F1002',
      currentRouteId: routeRefs[1].id,
      status: 'active',
      lastLocation: { lat: 15.3789, lng: 75.1178 },
      updatedAt: new Date().toISOString()
    },
    {
      id: busRefs[2].id,
      busNumber: 'KA-25-F-1003',
      unitNumber: 'BRTS-DS-01',
      registrationNumber: 'KA25F1003',
      currentRouteId: routeRefs[2].id,
      status: 'active',
      lastLocation: { lat: 15.3989, lng: 75.0978 },
      updatedAt: new Date().toISOString()
    },
    {
      id: busRefs[3].id,
      busNumber: 'KA-25-F-1004',
      unitNumber: 'BRTS-EV-03',
      registrationNumber: 'KA25F1004',
      status: 'maintenance',
      updatedAt: new Date().toISOString()
    }
  ];

  buses.forEach((bus, idx) => {
    batch.set(busRefs[idx], {
      busNumber: bus.busNumber,
      unitNumber: bus.unitNumber,
      registrationNumber: bus.registrationNumber,
      currentRouteId: bus.currentRouteId || '',
      status: bus.status,
      lastLocation: bus.lastLocation || null,
      updatedAt: bus.updatedAt
    });
  });

  // --- 3. SEED STOPS ---
  const stopRefs = [
    doc(collection(db, 'stops')),
    doc(collection(db, 'stops')),
    doc(collection(db, 'stops')),
    doc(collection(db, 'stops')),
    doc(collection(db, 'stops')),
    doc(collection(db, 'stops'))
  ];

  const stops: Stop[] = [
    {
      id: stopRefs[0].id,
      name: 'Hubballi CBT Stop',
      stopNumber: 'ST-HUB-01',
      order: 1,
      status: 'active',
      location: { lat: 15.3489, lng: 75.1378 }
    },
    {
      id: stopRefs[1].id,
      name: 'Dharwad CBT Stop',
      stopNumber: 'ST-DHD-01',
      order: 2,
      status: 'active',
      location: { lat: 15.4589, lng: 75.0078 }
    },
    {
      id: stopRefs[2].id,
      name: 'Unkal Lake Stop',
      stopNumber: 'ST-UNK-02',
      order: 3,
      status: 'active',
      location: { lat: 15.3789, lng: 75.1178 }
    },
    {
      id: stopRefs[3].id,
      name: 'SDM Hospital Stop',
      stopNumber: 'ST-SDM-03',
      order: 4,
      status: 'active',
      location: { lat: 15.4289, lng: 75.0578 }
    },
    {
      id: stopRefs[4].id,
      name: 'Rayapur Transit Stop',
      stopNumber: 'ST-RAY-04',
      order: 5,
      status: 'active',
      location: { lat: 15.4089, lng: 75.0878 }
    },
    {
      id: stopRefs[5].id,
      name: 'Navanagar Stop',
      stopNumber: 'ST-NAV-05',
      order: 6,
      status: 'active',
      location: { lat: 15.3989, lng: 75.0978 }
    }
  ];

  stops.forEach((stop, idx) => {
    batch.set(stopRefs[idx], {
      name: stop.name,
      stopNumber: stop.stopNumber,
      order: stop.order,
      status: stop.status,
      location: stop.location
    });
  });

  // --- 4. SEED TRIPS (TODAY, TOMORROW, NEXT DAY) ---
  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  const nextDay = new Date();
  nextDay.setDate(nextDay.getDate() + 2);
  const nextDayStr = nextDay.toISOString().split('T')[0];

  const dates = [todayStr, tomorrowStr, nextDayStr];
  const timeSlots = [
    { dep: '08:30 AM', arr: '09:15 AM', price: 30 },
    { dep: '11:15 AM', arr: '12:00 PM', price: 35 },
    { dep: '02:30 PM', arr: '03:15 PM', price: 40 },
    { dep: '05:45 PM', arr: '06:30 PM', price: 45 },
    { dep: '08:00 PM', arr: '08:45 PM', price: 30 }
  ];

  // Create a trip for each route & date & timeslot combination
  dates.forEach((dateStr) => {
    routes.forEach((route, rIdx) => {
      // Pick 2 slots per route per day to keep things dynamic but clean
      const slots = rIdx % 2 === 0 ? [timeSlots[0], timeSlots[3]] : [timeSlots[1], timeSlots[2], timeSlots[4]];
      
      slots.forEach((slot) => {
        const tripRef = doc(collection(db, 'trips'));
        const busIdx = (rIdx + slot.price) % buses.filter(b => b.status === 'active').length;
        const bus = buses.filter(b => b.status === 'active')[busIdx];

        batch.set(tripRef, {
          routeId: route.id,
          busId: bus.id,
          date: dateStr,
          departureTime: slot.dep,
          arrivalTime: slot.arr,
          price: slot.price,
          availableSeats: 20,
          totalSeats: 20,
          bookedSeats: [],
          status: 'scheduled'
        });
      });
    });
  });

  // --- 5. SEED SYSTEM ALERTS ---
  const alertRef1 = doc(collection(db, 'alerts'));
  batch.set(alertRef1, {
    title: 'Monsoon Green Fleet Update',
    message: 'All electric bus air suspension models have been optimized for rainy weather in the Twin Cities corridor.',
    type: 'info',
    createdAt: new Date().toISOString(),
    createdBy: profile.displayName || 'System Admin'
  });

  const alertRef2 = doc(collection(db, 'alerts'));
  batch.set(alertRef2, {
    title: 'Hubballi Express Lane Advisory',
    message: 'Dedicated BRTS bus lanes from Rayapur to Navanagar are restricted to authorized high-speed cruisers only.',
    type: 'warning',
    createdAt: new Date().toISOString(),
    createdBy: profile.displayName || 'System Admin'
  });

  // Commit all items synchronously
  await batch.commit();

  // Log the activity
  await logActivity(
    profile,
    'SEED_DATABASE',
    `Successfully initialized dynamic BRTS database with 4 routes, 4 buses, 6 stations, alerts, and 30+ trips across today, tomorrow, and subsequent days.`
  );
}
