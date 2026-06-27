/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  addDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/AuthContext";
import { logActivity } from "../lib/activityLogger";
import { Bell, Send, Clock, Users, ShieldAlert, Trash2, CheckCircle } from "lucide-react";
import { cn } from "../lib/utils";
import { BRAND_NAME, BRAND_TAGLINE } from "../constants";

interface UserItem {
  uid: string;
  email: string;
  displayName: string;
  role: string;
}

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: "info" | "warning" | "urgent";
  recipientType: "all" | "specific";
  targetUsers?: string[]; // Array of emails or uids
  timingType: "instant" | "scheduled";
  scheduledTime?: string;
  sendCount: number;
  sentCount: number;
  createdAt: string;
  createdBy: string;
}

export const NotifyPage = () => {
  const { profile } = useAuth();
  
  // States
  const [users, setUsers] = useState<UserItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Form Fields
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<"info" | "warning" | "urgent">("info");
  const [recipientType, setRecipientType] = useState<"all" | "specific">("all");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [timingType, setTimingType] = useState<"instant" | "scheduled">("instant");
  const [scheduledTime, setScheduledTime] = useState("");
  const [sendCount, setSendCount] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);

  // Fetch Users and Notification History
  useEffect(() => {
    // 1. Fetch Users
    const qUsers = query(collection(db, "users"));
    const unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
      setUsers(
        snapshot.docs.map((doc) => ({
          uid: doc.id,
          ...doc.data(),
        }) as UserItem)
      );
    });

    // 2. Fetch Notifications
    const qNotifications = query(
      collection(db, "notifications"),
      orderBy("createdAt", "desc")
    );
    const unsubscribeNotifications = onSnapshot(qNotifications, (snapshot) => {
      setNotifications(
        snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }) as NotificationItem)
      );
      setLoading(false);
    });

    return () => {
      unsubscribeUsers();
      unsubscribeNotifications();
    };
  }, []);

  const handleToggleUser = (email: string) => {
    if (selectedUsers.includes(email)) {
      setSelectedUsers(selectedUsers.filter((u) => u !== email));
    } else {
      setSelectedUsers([...selectedUsers, email]);
    }
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!title.trim() || !message.trim()) {
      alert("Please enter title and message.");
      return;
    }
    if (recipientType === "specific" && selectedUsers.length === 0) {
      alert("Please select at least one target user.");
      return;
    }
    if (timingType === "scheduled" && !scheduledTime) {
      alert("Please choose a date and time to schedule the notification.");
      return;
    }

    setSubmitting(true);
    try {
      const payload: Omit<NotificationItem, "id"> = {
        title: title.trim(),
        message: message.trim(),
        type,
        recipientType,
        targetUsers: recipientType === "specific" ? selectedUsers : [],
        timingType,
        scheduledTime: timingType === "scheduled" ? scheduledTime : "",
        sendCount: Number(sendCount) || 1,
        sentCount: timingType === "instant" ? 1 : 0,
        createdAt: new Date().toISOString(),
        createdBy: profile.email,
      };

      await addDoc(collection(db, "notifications"), payload);

      // Log the admin activity
      const logDetails = `${profile.role.toUpperCase()} ${profile.email} dispatched notification '${title}' targeted to ${
        recipientType === "all" ? "ALL USERS" : `${selectedUsers.length} users`
      }. Timing: ${timingType} (Repeat factor: ${sendCount} times).`;

      await logActivity(profile, "DISPATCH_NOTIFICATION", logDetails);

      // Reset Form State
      setTitle("");
      setMessage("");
      setType("info");
      setRecipientType("all");
      setSelectedUsers([]);
      setTimingType("instant");
      setScheduledTime("");
      setSendCount(1);

      alert(
        timingType === "instant"
          ? "Notification dispatched successfully!"
          : "Notification scheduled successfully!"
      );
    } catch (err: any) {
      console.error(err);
      alert("Failed to send notification: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteNotification = async (id: string, notifTitle: string) => {
    if (!window.confirm("Are you sure you want to delete this notification record?")) {
      return;
    }
    try {
      await deleteDoc(doc(db, "notifications", id));
      if (profile) {
        await logActivity(
          profile,
          "DELETE_NOTIFICATION",
          `User ${profile.email} deleted notification record: '${notifTitle}'`
        );
      }
    } catch (err: any) {
      console.error(err);
      alert("Failed to delete notification: " + err.message);
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 pb-10">
        <div className="space-y-1">
          <h2 className="text-4xl font-black text-slate-900 tracking-tight uppercase leading-none">
            {BRAND_NAME} Notify Center
          </h2>
          <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-[0.25em]">
            {BRAND_TAGLINE}
          </p>
        </div>
        <div className="flex items-center space-x-2 px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-2xl shadow-sm">
          <Bell className="w-4 h-4 text-indigo-600 animate-swing" />
          <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">
            Broadcast Terminal
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Form Controls Column */}
        <div className="lg:col-span-7 bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">
              Compose Alert
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              Dispatch dynamic alerts to passenger and dispatcher devices
            </p>
          </div>

          <form onSubmit={handleSendNotification} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Alert Title */}
              <div className="space-y-2 md:col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  Alert Header / Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. System Maintenance Alert"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-600 text-slate-900 text-xs font-black uppercase tracking-widest"
                />
              </div>

              {/* Alert Message */}
              <div className="space-y-2 md:col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  Broadcasting Message Body
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Type the message detail that users will receive on their dashboards..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-600 text-slate-900 text-xs font-bold tracking-wide"
                />
              </div>

              {/* Severity / Type */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  Severity Class
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["info", "warning", "urgent"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className={cn(
                        "py-3 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all",
                        type === t
                          ? t === "info"
                            ? "bg-indigo-600 border-indigo-600 text-white"
                            : t === "warning"
                              ? "bg-amber-500 border-amber-500 text-white"
                              : "bg-red-600 border-red-600 text-white animate-pulse"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300"
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Timing selector */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  Release Schedule
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTimingType("instant")}
                    className={cn(
                      "py-3 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all flex items-center justify-center space-x-2",
                      timingType === "instant"
                        ? "bg-indigo-600 border-indigo-600 text-white"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300"
                    )}
                  >
                    <Send className="w-3 h-3" />
                    <span>Instant</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimingType("scheduled")}
                    className={cn(
                      "py-3 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all flex items-center justify-center space-x-2",
                      timingType === "scheduled"
                        ? "bg-indigo-600 border-indigo-600 text-white"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300"
                    )}
                  >
                    <Clock className="w-3 h-3" />
                    <span>Scheduled</span>
                  </button>
                </div>
              </div>

              {/* Scheduled Date Field */}
              {timingType === "scheduled" && (
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    Scheduled Release Timestamp
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-600 text-slate-900 text-xs font-mono font-bold"
                  />
                </div>
              )}

              {/* Send Count (Frequency) */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  Dispatch Frequency (Times)
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min={1}
                    max={10}
                    required
                    value={sendCount}
                    onChange={(e) => setSendCount(Math.max(1, Number(e.target.value)))}
                    className="w-24 px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-600 text-slate-900 text-xs font-mono font-bold"
                  />
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                    Repeats for user validation
                  </span>
                </div>
              </div>

              {/* Recipient Audience */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  Recipient Audience
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRecipientType("all")}
                    className={cn(
                      "py-3 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all flex items-center justify-center space-x-2",
                      recipientType === "all"
                        ? "bg-indigo-600 border-indigo-600 text-white"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300"
                    )}
                  >
                    <Users className="w-3 h-3" />
                    <span>All Users</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecipientType("specific")}
                    className={cn(
                      "py-3 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all flex items-center justify-center space-x-2",
                      recipientType === "specific"
                        ? "bg-indigo-600 border-indigo-600 text-white"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300"
                    )}
                  >
                    <ShieldAlert className="w-3 h-3" />
                    <span>Specific Users</span>
                  </button>
                </div>
              </div>

              {/* Specific Users Checkboxes */}
              {recipientType === "specific" && (
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">
                    Select Target Identities ({selectedUsers.length} selected)
                  </label>
                  <div className="max-h-48 overflow-y-auto p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-2">
                    {users.map((u) => (
                      <label
                        key={u.uid}
                        className={cn(
                          "flex items-center space-x-3 p-3 rounded-xl cursor-pointer transition-all border",
                          selectedUsers.includes(u.email)
                            ? "bg-indigo-50/50 border-indigo-200 text-indigo-900"
                            : "bg-white border-slate-150 text-slate-600 hover:border-slate-300"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(u.email)}
                          onChange={() => handleToggleUser(u.email)}
                          className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-black uppercase tracking-wider truncate">
                            {u.displayName || "Anonymous User"}
                          </p>
                          <p className="text-[9px] font-mono text-slate-400 truncate">
                            {u.email} • {u.role.toUpperCase()}
                          </p>
                        </div>
                      </label>
                    ))}
                    {users.length === 0 && (
                      <p className="text-[10px] text-slate-400 italic text-center py-4 uppercase">
                        No registered system profiles available
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-5 bg-indigo-600 hover:bg-slate-900 disabled:bg-slate-300 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100 transition-all active:scale-95 flex items-center justify-center space-x-3 cursor-pointer"
              >
                {submitting ? (
                  <span>Processing...</span>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Broadcast Alert</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Audit / History Column */}
        <div className="lg:col-span-5 bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">
              Broadcast Log
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              Live database list of past alert schedules
            </p>
          </div>

          <div className="space-y-4 max-h-[500px] overflow-y-auto no-scrollbar">
            {notifications.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "p-5 rounded-3xl border relative group flex flex-col space-y-3 transition-all",
                  item.type === "urgent"
                    ? "bg-red-50/50 border-red-100"
                    : item.type === "warning"
                      ? "bg-amber-50/50 border-amber-100"
                      : "bg-indigo-50/30 border-indigo-100/50"
                )}
              >
                {/* Delete button */}
                <button
                  onClick={() => handleDeleteNotification(item.id, item.title)}
                  className="absolute right-4 top-4 p-1.5 bg-white hover:bg-red-50 text-slate-300 hover:text-red-600 border border-slate-100 hover:border-red-100 rounded-lg opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                  title="Purge alert"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>

                <div className="space-y-1 pr-6">
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider inline-block",
                      item.type === "urgent"
                        ? "bg-red-100 text-red-700"
                        : item.type === "warning"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-indigo-100 text-indigo-700"
                    )}
                  >
                    {item.type}
                  </span>
                  <h4 className="text-xs font-black uppercase tracking-tight text-slate-900">
                    {item.title}
                  </h4>
                  <p className="text-[10px] font-bold text-slate-600">
                    {item.message}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100/60 flex flex-wrap gap-x-4 gap-y-1.5 text-[8px] text-slate-400 font-bold uppercase tracking-wider">
                  <div className="flex items-center space-x-1">
                    <Users className="w-3 h-3 text-slate-300" />
                    <span>
                      Audience: {item.recipientType === "all" ? "ALL" : "SPECIFIC"}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Clock className="w-3 h-3 text-slate-300" />
                    <span>
                      {item.timingType === "instant"
                        ? "Dispatched"
                        : `Sched: ${new Date(item.scheduledTime || "").toLocaleString()}`}
                    </span>
                  </div>
                  <div>
                    <span>Freq: {item.sendCount}x</span>
                  </div>
                </div>
              </div>
            ))}

            {notifications.length === 0 && !loading && (
              <div className="py-20 text-center flex flex-col items-center justify-center space-y-3 text-slate-400">
                <Bell className="w-8 h-8 text-slate-200" />
                <p className="text-[10px] font-black uppercase tracking-widest">
                  No notifications recorded
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
