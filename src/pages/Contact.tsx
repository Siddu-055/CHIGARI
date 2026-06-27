import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, query, where, orderBy, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Ticket, TicketReply } from '../types';
import { MessageSquare, Send, Clock, User, CheckCircle2, AlertCircle, Trash2, ArrowLeft, MessageCircle, HelpCircle, Inbox, HelpCircle as HelpIcon, Lock, ShieldCheck, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { logActivity } from '../lib/activityLogger';

export const Contact = () => {
  const { user, profile } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Create New Ticket States
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Selected ticket for full view/conversation thread
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [replySubmitting, setReplySubmitting] = useState(false);
  
  const threadEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll inside active ticket chat thread
  useEffect(() => {
    if (threadEndRef.current) {
      threadEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedTicketId, tickets]);

  // Listen to user's tickets
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'tickets'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedTickets = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Ticket));
      setTickets(fetchedTickets);
      setLoading(false);

      // If there is an open ticket, auto-select it if nothing is selected
      const openTicket = fetchedTickets.find(t => t.status === 'open');
      if (openTicket && !selectedTicketId) {
        setSelectedTicketId(openTicket.id);
      }
    }, (err) => {
      console.error("Error loading tickets:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Find active ticket if any
  const activeTicket = tickets.find(t => t.status === 'open');
  const selectedTicket = tickets.find(t => t.id === selectedTicketId);

  // Create Ticket Submission
  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    if (activeTicket) {
      setError("You already have an active open ticket. Please close it before opening another.");
      return;
    }

    if (!subject.trim() || !message.trim()) {
      setError("Please fill in both subject and message fields.");
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const ticketData = {
        userId: user.uid,
        userEmail: user.email || profile.email,
        userDisplayName: profile.displayName || user.displayName || 'Anonymous Rider',
        subject: subject.trim(),
        message: message.trim(),
        status: 'open',
        createdAt: new Date().toISOString(),
        replies: []
      };

      const docRef = await addDoc(collection(db, 'tickets'), ticketData);
      
      // Log activity
      await logActivity(
        profile,
        'SUPPORT_TICKET_CREATE',
        `User opened support ticket: "${subject.trim()}" (Ticket ID: ${docRef.id})`
      );

      setSubject('');
      setMessage('');
      setSuccess('Your support ticket has been opened successfully. An agent will respond shortly.');
      setSelectedTicketId(docRef.id);
    } catch (err: any) {
      console.error("Failed to submit ticket:", err);
      setError(err.message || "Failed to submit support ticket. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Reply to ticket
  const handleSendReply = async (e: React.FormEvent) => {
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
        'SUPPORT_TICKET_REPLY',
        `User replied to support ticket: ${selectedTicket.id}`
      );

      setReplyMessage('');
    } catch (err) {
      console.error("Failed to send reply:", err);
    } finally {
      setReplySubmitting(false);
    }
  };

  // Close ticket
  const handleCloseTicket = async (ticketId: string) => {
    if (!user || !profile) return;
    const confirmClose = window.confirm("Are you sure you want to resolve and close this support ticket? Once closed, you can submit a new ticket.");
    if (!confirmClose) return;

    try {
      await updateDoc(doc(db, 'tickets', ticketId), {
        status: 'closed',
        closedAt: new Date().toISOString(),
        closedBy: user.uid
      });

      await logActivity(
        profile,
        'SUPPORT_TICKET_CLOSE',
        `User closed support ticket: ${ticketId}`
      );

      setSuccess("Ticket closed successfully. You are now free to submit another if needed.");
    } catch (err) {
      console.error("Failed to close ticket:", err);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-6 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Help Desk Heading */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-250/20 pb-5">
          <div>
            <div className="flex items-center space-x-2.5 mb-1.5">
              <MessageSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Transit Protocol Support</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-50 uppercase tracking-tight">Support Desk & Help center</h1>
          </div>
          
          <div className="flex items-center space-x-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-2.5 shadow-sm">
            <div className={cn(
              "w-2.5 h-2.5 rounded-full animate-pulse shrink-0",
              activeTicket ? "bg-amber-500" : "bg-emerald-500"
            )} />
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider leading-none">Ticket Clearance State</span>
              <span className="text-[10px] font-extrabold text-slate-800 dark:text-slate-250 uppercase mt-0.5">
                {activeTicket ? "1 Active Open Ticket" : "No Active Open Tickets (Authorized to file)"}
              </span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Sidebar Ticket History list */}
            <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm flex flex-col max-h-[70vh]">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/20 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Your Support Tickets ({tickets.length})</span>
                {!activeTicket && selectedTicketId && (
                  <button 
                    onClick={() => setSelectedTicketId(null)}
                    className="flex items-center space-x-1 text-[9px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/30 px-2 py-1 rounded-lg transition-all"
                  >
                    <Plus className="w-3 h-3" />
                    <span>File New</span>
                  </button>
                )}
              </div>

              <div className="overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 no-scrollbar flex-1">
                {tickets.map((t) => {
                  const isActive = t.id === selectedTicketId;
                  const isClosed = t.status === 'closed';
                  return (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTicketId(t.id)}
                      className={cn(
                        "w-full text-left p-4 hover:bg-slate-50/65 dark:hover:bg-slate-850/40 transition-all flex flex-col gap-2 relative",
                        isActive ? "bg-indigo-50/30 dark:bg-indigo-950/20 border-l-4 border-indigo-600 dark:border-indigo-400" : ""
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn(
                          "text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0",
                          isClosed 
                            ? "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400" 
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 animate-pulse"
                        )}>
                          {t.status}
                        </span>
                        <span className="text-[8px] font-bold text-slate-400 font-mono">
                          {new Date(t.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{t.subject}</h4>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">{t.message}</p>
                      </div>

                      {t.replies.length > 0 && (
                        <div className="flex items-center space-x-1.5 mt-1">
                          <MessageCircle className="w-3 h-3 text-indigo-500" />
                          <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400">
                            {t.replies.length} replies
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}

                {tickets.length === 0 && (
                  <div className="py-16 text-center">
                    <Inbox className="w-8 h-8 text-slate-200 dark:text-slate-800 mx-auto mb-2" />
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">No support tickets</p>
                    <p className="text-[9px] text-slate-400 dark:text-slate-600 max-w-[200px] mx-auto mt-1 leading-normal">Have inquiries or report issues? Open your first ticket.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Main Interactive Stage */}
            <div className="lg:col-span-8 space-y-4">
              
              <AnimatePresence mode="wait">
                
                {selectedTicketId && selectedTicket ? (
                  /* active conversation thread view */
                  <motion.div
                    key="conversation"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden flex flex-col h-[70vh]"
                  >
                    {/* Thread Header */}
                    <div className="p-5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center space-x-3">
                        <button 
                          onClick={() => setSelectedTicketId(null)}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer text-slate-500"
                        >
                          <ArrowLeft className="w-4 h-4" />
                        </button>
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
                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Ticket Thread</span>
                          </div>
                          <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-50 mt-1 truncate max-w-md">
                            {selectedTicket.subject}
                          </h2>
                        </div>
                      </div>

                      {selectedTicket.status === 'open' && (
                        <button
                          onClick={() => handleCloseTicket(selectedTicket.id)}
                          className="self-start sm:self-center bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-100 hover:border-rose-200 text-[10px] font-black uppercase tracking-widest px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center space-x-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Close Ticket</span>
                        </button>
                      )}
                    </div>

                    {/* Messages Body */}
                    <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-slate-50/15 dark:bg-slate-950/10 no-scrollbar">
                      
                      {/* Base User Query Card */}
                      <div className="flex items-start gap-3 max-w-[85%]">
                        <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                          <User className="w-4.5 h-4.5" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-baseline space-x-2">
                            <span className="text-[10px] font-black uppercase text-slate-700 dark:text-slate-300">
                              {selectedTicket.userDisplayName}
                            </span>
                            <span className="text-[8px] text-slate-400 font-mono">
                              {new Date(selectedTicket.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </span>
                          </div>
                          <div className="bg-white dark:bg-slate-850 p-4 rounded-2xl rounded-tl-none border border-slate-100 dark:border-slate-800 shadow-sm text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                            {selectedTicket.message}
                          </div>
                        </div>
                      </div>

                      {/* Replies List */}
                      {selectedTicket.replies.map((reply, idx) => {
                        const isAdminReply = reply.senderRole === 'admin' || reply.senderRole === 'red_admin';
                        return (
                          <div 
                            key={idx}
                            className={cn(
                              "flex items-start gap-3 max-w-[85%] mt-4",
                              isAdminReply ? "ml-auto flex-row-reverse" : ""
                            )}
                          >
                            <div className={cn(
                              "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
                              isAdminReply 
                                ? "bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400" 
                                : "bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400"
                            )}>
                              {isAdminReply ? <ShieldCheck className="w-4.5 h-4.5" /> : <User className="w-4.5 h-4.5" />}
                            </div>
                            <div className={cn("flex flex-col gap-1", isAdminReply ? "items-end" : "")}>
                              <div className="flex items-baseline gap-2">
                                <span className={cn(
                                  "text-[10px] font-black uppercase",
                                  isAdminReply ? "text-amber-600 dark:text-amber-400" : "text-slate-700 dark:text-slate-300"
                                )}>
                                  {isAdminReply ? "Support Agent" : reply.senderEmail.split('@')[0]}
                                </span>
                                <span className="text-[8px] text-slate-400 font-mono">
                                  {new Date(reply.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </span>
                              </div>
                              <div className={cn(
                                "p-4 rounded-2xl shadow-sm text-xs leading-relaxed font-medium",
                                isAdminReply 
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
                            Ticket Resolved and Closed
                          </span>
                        </div>
                      )}

                      <div ref={threadEndRef} />
                    </div>

                    {/* Chat Input Field (Only open tickets) */}
                    {selectedTicket.status === 'open' && (
                      <form 
                        onSubmit={handleSendReply}
                        className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-3 shrink-0"
                      >
                        <input
                          type="text"
                          value={replyMessage}
                          onChange={(e) => setReplyMessage(e.target.value)}
                          placeholder="Type your message to support..."
                          disabled={replySubmitting}
                          className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all"
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
                  /* Create New Ticket Form */
                  <motion.div
                    key="create-form"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] shadow-sm p-6 sm:p-8"
                  >
                    <div className="flex items-center space-x-3 mb-6">
                      <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                        <HelpIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-base font-black text-slate-950 dark:text-slate-50 uppercase tracking-wider">File a support ticket</h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Please provide details of your issue or inquiry</p>
                      </div>
                    </div>

                    {success && (
                      <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl flex items-start gap-3">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                        <div className="flex-1 text-xs font-semibold text-emerald-850 dark:text-emerald-400">
                          {success}
                        </div>
                      </div>
                    )}

                    {error && (
                      <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-2xl flex items-start gap-3">
                        <AlertCircle className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
                        <div className="flex-1 text-xs font-semibold text-rose-800 dark:text-rose-400">
                          {error}
                        </div>
                      </div>
                    )}

                    {activeTicket ? (
                      <div className="p-6 border border-amber-100 dark:border-amber-900/30 bg-amber-50/20 dark:bg-amber-950/10 rounded-2xl text-center space-y-3">
                        <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
                        <h4 className="text-xs font-extrabold text-amber-800 dark:text-amber-400 uppercase tracking-widest">Active Ticket Limit Reached</h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-normal">
                          You have an active open support ticket: <span className="font-extrabold text-slate-800 dark:text-slate-200">"{activeTicket.subject}"</span>. To keep communications clean and organized, please resolve and close it before filing a new inquiry.
                        </p>
                        <button
                          onClick={() => setSelectedTicketId(activeTicket.id)}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl shadow-md transition-all cursor-pointer inline-block"
                        >
                          Go to active thread
                        </button>
                      </div>
                    ) : (
                      <form onSubmit={handleSubmitTicket} className="space-y-5">
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Subject / Inquiry Title</label>
                          <input
                            type="text"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            placeholder="e.g. Inaccurate stop location, schedule mismatch, app feedback"
                            disabled={submitting}
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-bold text-slate-850 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all"
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Detailed Message</label>
                          <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            rows={6}
                            placeholder="Please provide full details of your report so that regional transit dispatch and admin personnel can assist you accurately."
                            disabled={submitting}
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-bold text-slate-850 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-all"
                            required
                          />
                        </div>

                        <div className="pt-2 flex justify-end">
                          <button
                            type="submit"
                            disabled={submitting}
                            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-150 text-white text-[10px] font-black uppercase tracking-[0.2em] px-6 py-3 rounded-2xl shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer flex items-center space-x-2"
                          >
                            <span>SUBMIT SUPPORT TICKET</span>
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </form>
                    )}

                  </motion.div>
                )}

              </AnimatePresence>

            </div>

          </div>
        )}

      </div>
    </div>
  );
};
