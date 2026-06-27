/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'admin' | 'red_admin' | 'dispatcher' | 'passenger';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: string;
  photoURL?: string;
  theme?: 'light' | 'dark' | 'system';
  weeklyVisits?: number;
}

export interface Route {
  id: string;
  name: string;
  origin: string;
  destination: string;
  color: string;
  order?: number;
  busNumber?: string;
  status?: 'active' | 'inactive' | 'maintenance';
}

export interface Bus {
  id: string;
  busNumber: string;
  unitNumber?: string;
  registrationNumber?: string;
  currentRouteId?: string;
  status: 'active' | 'inactive' | 'maintenance';
  lastLocation?: {
    lat: number;
    lng: number;
  };
  updatedAt: string;
}

export interface Stop {
  id: string;
  name: string;
  stopNumber?: string;
  mapUrl?: string;
  order?: number;
  status?: 'active' | 'inactive' | 'maintenance';
  location: {
    lat: number;
    lng: number;
  };
  onlyTheseBuses?: string[];
}

export interface Schedule {
  id: string;
  routeId: string;
  busId: string;
  departureTime: string;
  daysOfWeek: string[];
}

export interface Trip {
  id: string;
  routeId: string;
  busId: string;
  date: string;
  departureTime: string;
  arrivalTime: string;
  price: number;
  availableSeats: number;
  totalSeats: number;
  bookedSeats: number[];
  status: 'scheduled' | 'on-time' | 'delayed' | 'completed' | 'cancelled';
}

export interface Booking {
  id: string;
  tripId: string;
  userId: string;
  seatNumbers: number[];
  totalAmount: number;
  status: 'confirmed' | 'cancelled' | 'pending';
  createdAt: string;
}

export interface Alert {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'urgent';
  createdAt: string;
  createdBy: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userEmail: string;
  userRole: string;
  action: string;
  details: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'instant' | 'scheduled';
  scheduledTime?: string;
  targetType: 'all' | 'specific';
  targetUsers?: string[];
  sendCount: number;
  createdAt: string;
  createdBy: string;
}

export interface TicketReply {
  senderId: string;
  senderEmail: string;
  senderRole: string;
  message: string;
  createdAt: string;
}

export interface Ticket {
  id: string;
  userId: string;
  userEmail: string;
  userDisplayName: string;
  subject: string;
  message: string;
  status: 'open' | 'closed';
  createdAt: string;
  replies: TicketReply[];
  closedAt?: string;
  closedBy?: string;
}

