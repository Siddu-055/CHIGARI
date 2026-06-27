import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Ticket, TicketReply } from '../types';
import { MessageSquare, Send, Clock, User, CheckCircle2, AlertCircle, Search, Filter, Inbox, ArrowLeft, ShieldAlert, Lock, CheckCircle, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { logActivity } from '../lib/activityLogger';

export const Reports = () => {
  const { user, profile } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtering and Searching States
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  // Reply States
  const [replyMessage, setReplyMessage] = useState('');
  const [replySubmitting, setReplySubmitting] = useState(false);

  const threadEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to latest reply inside active chat
  useEffect(() => {
    if (threadEndRef.current) {
      threadEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedTicketId, tickets]);

  // Load all tickets
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'tickets'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Ticket));
      setTickets(fetched);
      setLoading(false);
    }, (err) => {
      console.error("Error loading tickets for reports:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Get active selected ticket
  const selectedTicket = tickets.find(t => t.id === selectedTicketId);

  // Apply filters and searches
  const filteredTickets = tickets.filter(t => {
    const matchesSearch = 
      t.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.userDisplayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.message.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' ? true : t.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Admin replies to ticket
  const handleAdminReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile || !selectedTicket) return;
    if (!replyMessage.trim()) return;

    setReplySubmitting(true);

    try {
      const newReply: TicketReply = {
        senderId: user.uid,
        senderEmail: user.email || profile.email,
        senderRole: profile.role,
        message: replyMessage.trim(),
        createdAt: new Date().toISOString()
      };

      const updatedReplies = [...selectedTicket.replies, newReply];
      await updateDoc(doc(db, 'tickets', selectedTicket.id), {
        replies: updatedReplies
      });

      // Log activity
      await logActivity(
        profile,
        'SUPPORT_TICKET_ADMIN_REPLY',
        `Admin (${profile.role}) replied to support ticket ${selectedTicket.id} from user ${selectedTicket.userEmail}`
      );

      setReplyMessage('');
    } catch (err) {
      console.error("Failed to send admin reply:", err);
    } finally {
      setReplySubmitting(false);
    }
  };

  // Admin resolves/closes ticket
  const handleResolveTicket = async (ticketId: string) => {
    if (!user || !profile) return;
    const confirmClose = window.confirm("Are you sure you want to resolve and close this ticket? This will permit the customer to open a new ticket if needed.");
    if (!confirmClose) return;

    try {
      await updateDoc(doc(db, 'tickets', ticketId), {
        status: 'closed',
        closedAt: new Date().toISOString(),
        closedBy: user.uid
      });

      await logActivity(
        profile,
        'SUPPORT_TICKET_RESOLVED',
        `Admin closed support ticket ${ticketId}`
      );
    } catch (err) {
      console.error("Failed to resolve ticket:", err);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-6 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200/25 pb-5">
          <div>
            <div className="flex items-center space-x-2 mb-1.5">
              <ShieldAlert className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Admin Control Center</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-50 uppercase tracking-tight">Support Reports & Tickets</h1>
          </div>

          <div className="flex items-center space-x-4">
            {/* Total counts badges */}
            <div className="flex gap-2.5">
              <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl px-3.5 py-2 text-center">
                <span className="text-[8px] font-black uppercase text-emerald-600 tracking-wider block">Open Tickets</span>
                <span className="text-sm font-black text-emerald-700 dark:text-emerald-400 mt-0.5 block">
                  {tickets.filter(t => t.status === 'open').length}
                </span>
              </div>
              <div className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2 text-center">
                <span className="text-[8px] font-black uppercase text-slate-500 tracking-wider block">Total Tickets</span>
                <span className="text-sm font-black text-slate-700 dark:text-slate-300 mt-0.5 block">
                  {tickets.length}
                </span>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left Panel: Search, Filter & Ticket List */}
            <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] shadow-sm overflow-hidden flex flex-col max-h-[72vh]">
              {/* Search & Filter bar */}
              <div className="p-4 space-y-3 bg-slate-50/50 dark:bg-slate-950/10 border-b border-slate-100 dark:border-slate-850">
                <div className="relative">
                  <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by email, name, subject..."
                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-between gap-2 pt-1.5">
                  <div className="flex items-center space-x-1.5">
                    <Filter className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest">Filter Status</span>
                  </div>
                  <div className="flex bg-slate-150 dark:bg-slate-950 p-1 rounded-xl">
                    {(['all', 'open', 'closed'] as const).map((st) => (
                      <button
                        key={st}
                        onClick={() => setStatusFilter(st)}
                        className={cn(
                          "px-3 py-1 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer",
                          statusFilter === st 
                            ? "bg-white dark:bg-slate-850 text-indigo-600 dark:text-indigo-400 shadow-sm" 
                            : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                        )}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tickets List */}
              <div className="overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 no-scrollbar flex-1">
                {filteredTickets.map((t) => {
                  const isActive = t.id === selectedTicketId;
                  const isClosed = t.status === 'closed';
                  return (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTicketId(t.id)}
                      className={cn(
                        "w-full text-left p-4 hover:bg-slate-50/65 dark:hover:bg-slate-850/40 transition-all flex flex-col gap-2 relative",
                        isActive ? "bg-indigo-50/30 dark:bg-indigo-950/20 border-l-4 border-indigo-600 dark:border-indigo-400 font-extrabold" : ""
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[8px] font-bold text-slate-400 font-mono">
                          {new Date(t.createdAt).toLocaleString()}
                        </span>
                        <span className={cn(
                          "text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0",
                          isClosed 
                            ? "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400" 
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                        )}>
                          {t.status}
                        </span>
                      </div>

                      <div className="min-w-0">
                        <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 truncate">{t.subject}</h4>
                        <div className="flex flex-col gap-0.5 mt-1">
                          <span className="text-[9px] font-bold text-slate-700 dark:text-slate-355 truncate">{t.userDisplayName}</span>
                          <span className="text-[8px] text-slate-400 dark:text-slate-500 truncate font-mono">{t.userEmail}</span>
                        </div>
                      </div>

                      {t.replies.length > 0 ? (
                        <div className="flex items-center space-x-1.5 mt-1.5">
                          <span className="text-[8px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest bg-indigo-55/40 dark:bg-indigo-950/30 px-2 py-0.5 rounded-md">
                            {t.replies.length} REPLIES
                          </span>
                          <span className="text-[8px] text-slate-400 font-mono">
                            Last Reply {new Date(t.replies[t.replies.length - 1].createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </span>
                        </div>
                      ) : (
                        <div className="mt-1.5">
                          <span className="text-[8px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md">
                            AWAITING REPLY
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}

                {filteredTickets.length === 0 && (
                  <div className="py-20 text-center">
                    <Inbox className="w-9 h-9 text-slate-200 dark:text-slate-800 mx-auto mb-2" />
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">No matching tickets</p>
                    <p className="text-[9px] text-slate-400 dark:text-slate-600 mt-1 leading-normal max-w-[220px] mx-auto">Try revising your search string or toggling filters.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel: Detail view & messaging thread */}
            <div className="lg:col-span-7">
              <AnimatePresence mode="wait">
                {selectedTicketId && selectedTicket ? (
                  <motion.div
                    key="detail-conversation"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] shadow-sm overflow-hidden flex flex-col h-[72vh]"
                  >
                    {/* Header */}
                    <div className="p-5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className={cn(
                            "text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0",
                            selectedTicket.status === 'closed' 
                              ? "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400" 
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 animate-pulse"
                          )}>
                            {selectedTicket.status}
                          </span>
                          <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider font-mono">TICKET: {selectedTicket.id.slice(0, 8)}</span>
                        </div>
                        <h2 className="text-sm font-black text-slate-900 dark:text-slate-50 mt-1.5 leading-snug">
                          {selectedTicket.subject}
                        </h2>
                      </div>

                      {selectedTicket.status === 'open' && (
                        <button
                          onClick={() => handleResolveTicket(selectedTicket.id)}
                          className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-100 hover:border-emerald-250 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center space-x-1.5 self-start sm:self-center"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Resolve & Close</span>
                        </button>
                      )}
                    </div>

                    {/* Meta User Card banner */}
                    <div className="bg-slate-50/80 dark:bg-slate-950/30 px-5 py-3 border-b border-slate-100 dark:border-slate-850 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black">
                          {selectedTicket.userDisplayName[0]}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-slate-800 dark:text-slate-200 leading-none">{selectedTicket.userDisplayName}</span>
                          <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono mt-0.5 leading-none">{selectedTicket.userEmail}</span>
                        </div>
                      </div>
                      
                      <div className="text-[9px] font-semibold text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2 py-1 rounded-lg">
                        USER ID: <span className="font-mono font-bold text-slate-650 dark:text-slate-350">{selectedTicket.userId}</span>
                      </div>
                    </div>

                    {/* Messages list */}
                    <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/15 dark:bg-slate-950/10 no-scrollbar">
                      
                      {/* Initial Ticket Request */}
                      <div className="flex items-start gap-3 max-w-[85%]">
                        <div className="w-8 h-8 rounded-xl bg-indigo-105 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                          <User className="w-4.5 h-4.5" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-baseline space-x-2">
                            <span className="text-[10px] font-black uppercase text-slate-700 dark:text-slate-300">
                              {selectedTicket.userDisplayName}
                            </span>
                            <span className="text-[8px] text-slate-400 font-mono">
                              {new Date(selectedTicket.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <div className="bg-white dark:bg-slate-850 p-4 rounded-2xl rounded-tl-none border border-slate-100 dark:border-slate-800 shadow-sm text-xs font-semibold text-slate-800 dark:text-slate-200 leading-relaxed">
                            {selectedTicket.message}
                          </div>
                        </div>
                      </div>

                      {/* Conversation Replies stream */}
                      {selectedTicket.replies.map((reply, idx) => {
                        const isAgent = reply.senderRole === 'admin' || reply.senderRole === 'red_admin';
                        return (
                          <div 
                            key={idx}
                            className={cn(
                              "flex items-start gap-3 max-w-[85%]",
                              isAgent ? "ml-auto flex-row-reverse" : ""
                            )}
                          >
                            <div className={cn(
                              "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
                              isAgent 
                                ? "bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400" 
                                : "bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400"
                            )}>
                              {isAgent ? <ShieldCheck className="w-4.5 h-4.5" /> : <User className="w-4.5 h-4.5" />}
                            </div>
                            <div className={cn("flex flex-col gap-1", isAgent ? "items-end" : "")}>
                              <div className="flex items-baseline gap-2">
                                <span className={cn(
                                  "text-[10px] font-black uppercase",
                                  isAgent ? "text-amber-600 dark:text-amber-400" : "text-slate-700 dark:text-slate-300"
                                )}>
                                  {isAgent ? `Support Agent (${reply.senderEmail.split('@')[0]})` : reply.senderEmail.split('@')[0]}
                                </span>
                                <span className="text-[8px] text-slate-400 font-mono">
                                  {new Date(reply.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </span>
                              </div>
                              <div className={cn(
                                "p-4 rounded-2xl shadow-sm text-xs font-semibold leading-relaxed",
                                isAgent 
                                  ? "bg-indigo-900 text-white rounded-tr-none" 
                                  : "bg-white dark:bg-slate-850 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-800 rounded-tl-none"
                              )}>
                                {reply.message}
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {selectedTicket.status === 'closed' && (
                        <div className="flex items-center justify-center space-x-2 py-4 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
                          <Lock className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                            Closed / Resolved Support Ticket
                          </span>
                        </div>
                      )}

                      <div ref={threadEndRef} />
                    </div>

                    {/* Reply Input Form */}
                    {selectedTicket.status === 'open' && (
                      <form 
                        onSubmit={handleAdminReply}
                        className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-3 shrink-0"
                      >
                        <input
                          type="text"
                          value={replyMessage}
                          onChange={(e) => setReplyMessage(e.target.value)}
                          placeholder={`Replying as Support Agent (${profile?.role?.toUpperCase()})...`}
                          disabled={replySubmitting}
                          className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-bold text-slate-850 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all"
                        />
                        <button
                          type="submit"
                          disabled={replySubmitting || !replyMessage.trim()}
                          className="p-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-100 dark:disabled:bg-slate-800 text-white disabled:text-slate-400 rounded-2xl shadow-md cursor-pointer transition-all hover:scale-105 active:scale-95"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </form>
                    )}
                  </motion.div>
                ) : (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] p-12 text-center shadow-sm h-[72vh] flex flex-col justify-center items-center">
                    <div className="p-4 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-3xl mb-4">
                      <MessageSquare className="w-8 h-8" />
                    </div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-slate-50 uppercase tracking-widest">No Ticket Selected</h3>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 max-w-xs uppercase mt-2 leading-relaxed">
                      Select a support ticket from the side list panel to review detailed inquiries and respond to riders.
                    </p>
                  </div>
                )}
              </AnimatePresence>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
