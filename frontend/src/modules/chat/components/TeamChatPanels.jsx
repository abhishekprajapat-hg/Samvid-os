import React from "react";
import {
  MessageSquare,
  Phone,
  PhoneCall,
  PhoneOff,
  RefreshCw,
  Search,
  Users,
  Video,
} from "lucide-react";

export const TeamChatSidebar = ({
  mobileSidebarVisible,
  activeContact,
  isDark,
  conversations,
  unreadTotal,
  onRefresh,
  refreshing,
  chatSearch,
  setChatSearch,
  mobileListMode,
  setMobileListMode,
  socketConnected,
  filteredConversations,
  currentUserId,
  selectedConversationId,
  unreadByConversation,
  onPickConversation,
  getOtherParticipant,
  getInitials,
  toSidebarTime,
  roleBadgeClass,
  filteredContacts,
  selectedContactId,
  onPickContact,
  contactsCount,
  chatFilter,
  setChatFilter,
  callHistoryLoading,
  callHistory,
  callSummary = { total: 0, completed: 0, missed: 0 },
  activeCall,
  incomingCall,
  canUseCalls,
  onStartAudioCall,
  onStartVideoCall,
  onEndCall,
  toId,
  normalizeCallMode,
  toCallHistoryStatusLabel,
  toDayLabel,
}) => (
  <aside className={`${mobileSidebarVisible ? "flex" : "hidden md:flex"} min-h-0 flex-col overflow-hidden border-b p-2 pb-3 sm:p-3 md:border-b-0 md:border-r ${
    isDark ? "border-slate-700 bg-slate-900/85" : "border-slate-200 bg-white"
  }`}>
    <div
      className={`rounded-xl border px-2.5 py-2.5 sm:px-3 ${
        isDark
          ? "border-slate-700 bg-slate-950/60"
          : "border-emerald-200 bg-emerald-50"
      }`}
      style={{
        backgroundImage: isDark
          ? "radial-gradient(circle at top right, rgba(6,182,212,0.16), transparent 45%)"
          : "radial-gradient(circle at top right, rgba(6,182,212,0.12), transparent 45%)",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className={`inline-flex items-center gap-1.5 text-sm font-semibold ${isDark ? "text-slate-100" : "text-emerald-700"}`}>
            <MessageSquare size={14} />
            Samvid Chat
          </p>
          <p className={`text-[11px] ${isDark ? "text-slate-400" : "text-emerald-600/90"}`}>
            {conversations.length} chats active
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadTotal > 0 && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
              isDark ? "bg-rose-500 text-white" : "bg-rose-600 text-white"
            }`}>
              {unreadTotal > 99 ? "99+" : unreadTotal}
            </span>
          )}
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className={`flex h-8 w-8 items-center justify-center rounded-lg border ${
              isDark
                ? "border-slate-700 text-slate-300 hover:border-cyan-300/40 hover:text-cyan-200"
                : "border-emerald-300 text-emerald-700 hover:border-emerald-500 hover:text-emerald-800"
            } disabled:opacity-60`}
            title="Refresh chats"
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      <div className={`mt-2 flex h-10 items-center gap-2 rounded-lg border px-2.5 ${
        isDark
          ? "border-slate-700 bg-slate-900/90 text-slate-300"
          : "border-emerald-200 bg-white text-slate-600"
      }`}>
        <Search size={14} />
        <input
          value={chatSearch}
          onChange={(event) => setChatSearch(event.target.value)}
          placeholder="Search chats or contacts"
          className={`w-full bg-transparent text-sm outline-none ${
            isDark ? "placeholder:text-slate-500" : "placeholder:text-slate-400"
          }`}
        />
      </div>

      <div className={`mt-2 grid grid-cols-2 gap-1 rounded-lg p-1 ${
        isDark ? "bg-slate-900/90" : "bg-slate-100"
      }`}>
        <button
          type="button"
          onClick={() => setChatFilter("all")}
          className={`h-8 truncate rounded-md px-2 text-xs font-semibold ${
            chatFilter === "all"
              ? isDark
                ? "bg-cyan-500/20 text-cyan-100"
                : "bg-white text-emerald-700 shadow-sm"
              : isDark
                ? "text-slate-300"
                : "text-slate-600"
          }`}
        >
          All Chats
        </button>
        <button
          type="button"
          onClick={() => setChatFilter("unread")}
          className={`h-8 truncate rounded-md px-2 text-xs font-semibold ${
            chatFilter === "unread"
              ? isDark
                ? "bg-cyan-500/20 text-cyan-100"
                : "bg-white text-emerald-700 shadow-sm"
              : isDark
                ? "text-slate-300"
                : "text-slate-600"
          }`}
        >
          Unread
          {unreadTotal > 0 ? ` (${unreadTotal > 99 ? "99+" : unreadTotal})` : ""}
        </button>
      </div>

      <div className={`mt-2 grid grid-cols-3 gap-1 rounded-lg p-1 md:hidden ${
        isDark ? "bg-slate-900/90" : "bg-slate-100"
      }`}>
        <button
          type="button"
          onClick={() => setMobileListMode("chats")}
          className={`h-8 truncate rounded-md px-2 text-xs font-semibold ${
            mobileListMode === "chats"
              ? isDark
                ? "bg-cyan-500/20 text-cyan-100"
                : "bg-white text-emerald-700 shadow-sm"
              : isDark
                ? "text-slate-300"
                : "text-slate-600"
          }`}
        >
          Chats
        </button>
        <button
          type="button"
          onClick={() => setMobileListMode("calls")}
          className={`h-8 truncate rounded-md px-2 text-xs font-semibold ${
            mobileListMode === "calls"
              ? isDark
                ? "bg-cyan-500/20 text-cyan-100"
                : "bg-white text-emerald-700 shadow-sm"
              : isDark
                ? "text-slate-300"
                : "text-slate-600"
          }`}
        >
          Calls
        </button>
        <button
          type="button"
          onClick={() => setMobileListMode("contacts")}
          className={`h-8 truncate rounded-md px-2 text-xs font-semibold ${
            mobileListMode === "contacts"
              ? isDark
                ? "bg-cyan-500/20 text-cyan-100"
                : "bg-white text-emerald-700 shadow-sm"
              : isDark
                ? "text-slate-300"
                : "text-slate-600"
          }`}
        >
          Contacts
        </button>
      </div>

      <p className={`mt-2 text-[10px] uppercase tracking-[0.14em] ${
        socketConnected
          ? isDark
            ? "text-emerald-300"
            : "text-emerald-700"
          : isDark
            ? "text-amber-300"
            : "text-amber-700"
      }`}>
        {socketConnected ? "Realtime connected" : "Reconnecting..."}
      </p>
      <p className={`mt-1 text-[10px] ${isDark ? "text-slate-500" : "text-slate-500"}`}>
        Showing {filteredConversations.length} / {conversations.length} chats
      </p>
    </div>

    <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-0 pb-[calc(0.5rem+env(safe-area-inset-bottom))] sm:pr-1 custom-scrollbar">
      <div className={mobileListMode === "chats" ? "" : "hidden md:block"}>
        <p className={`hidden pb-1 pl-1 text-[11px] font-semibold uppercase tracking-[0.14em] md:block ${isDark ? "text-slate-400" : "text-slate-500"}`}>
          Conversations
        </p>
        <div className="space-y-1.5">
          {filteredConversations.map((conversation) => {
            const peer = getOtherParticipant(conversation, currentUserId);
            if (!peer) return null;
            const active = String(conversation._id) === String(selectedConversationId);
            const unreadCount = Math.max(
              0,
              Number(unreadByConversation[String(conversation._id)] ?? 0),
            );

            return (
              <button
                key={conversation._id}
                type="button"
                onClick={() => onPickConversation(conversation._id)}
                className={`w-full rounded-2xl border p-2 text-left transition sm:p-2.5 ${
                  active
                    ? isDark
                      ? "border-cyan-400/45 bg-cyan-500/12"
                      : "border-emerald-300 bg-emerald-50"
                    : isDark
                      ? "border-transparent hover:border-slate-700 hover:bg-slate-950/70"
                      : "border-slate-200 bg-slate-50 hover:border-slate-300"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold sm:h-10 sm:w-10 ${
                    isDark ? "bg-slate-800 text-slate-200" : "bg-slate-200 text-slate-700"
                  }`}>
                    {getInitials(peer.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`truncate text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                        {peer.name}
                      </p>
                      <p className={`shrink-0 text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                        {toSidebarTime(conversation.lastMessageAt || conversation.updatedAt)}
                      </p>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <p className={`truncate text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                        {conversation.lastMessage || "Start chatting"}
                      </p>
                      {unreadCount > 0 && (
                        <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                          isDark ? "bg-cyan-500 text-slate-950" : "bg-emerald-600 text-white"
                        }`}>
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      )}
                    </div>
                    <span className={`mt-1 inline-flex max-w-full truncate rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${roleBadgeClass(peer.role, isDark)}`}>
                      {peer.roleLabel || peer.role}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
          {filteredConversations.length === 0 && (
            <div className={`rounded-xl border border-dashed px-3 py-4 text-center text-xs ${isDark ? "border-slate-700 text-slate-400" : "border-slate-300 text-slate-500"}`}>
              No chats found
            </div>
          )}
        </div>
      </div>

      <div className={mobileListMode === "contacts" ? "" : "hidden md:block"}>
        <div className="mb-1 flex items-center justify-between">
          <p className={`hidden pb-1 pl-1 text-[11px] font-semibold uppercase tracking-[0.14em] md:block ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            Start New Chat
          </p>
          <span className={`inline-flex items-center gap-1 text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            <Users size={12} />
            {contactsCount}
          </span>
        </div>
        <div className="space-y-1.5">
          {filteredContacts.map((contact) => {
            const active = !selectedConversationId && String(contact._id) === String(selectedContactId);
            return (
              <button
                key={contact._id}
                type="button"
                onClick={() => onPickContact(contact._id)}
                className={`w-full rounded-xl border px-2.5 py-2 text-left transition-colors sm:py-2.5 ${
                  active
                    ? isDark
                      ? "border-cyan-400/35 bg-cyan-500/12"
                      : "border-emerald-300 bg-emerald-50"
                    : isDark
                      ? "border-transparent hover:border-slate-700 hover:bg-slate-950/70"
                      : "border-transparent hover:border-slate-200 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                      isDark ? "bg-slate-800 text-slate-200" : "bg-slate-200 text-slate-700"
                    }`}>
                      {getInitials(contact.name)}
                    </div>
                    <p className={`truncate text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                      {contact.name}
                    </p>
                  </div>
                  <span className={`max-w-[45%] truncate rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${roleBadgeClass(contact.role, isDark)}`}>
                    {contact.roleLabel || contact.role}
                  </span>
                </div>
              </button>
            );
          })}
          {filteredContacts.length === 0 && (
            <div className={`rounded-xl border border-dashed px-3 py-4 text-center text-xs ${
              isDark ? "border-slate-700 text-slate-400" : "border-slate-300 text-slate-500"
            }`}>
              No contacts found
            </div>
          )}
        </div>
      </div>

      <div className={mobileListMode === "calls" ? "md:hidden" : "hidden"}>
        <div className={`rounded-xl border px-3 py-2.5 ${
          isDark ? "border-slate-700 bg-slate-950/60" : "border-slate-200 bg-slate-50"
        }`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className={`inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] ${
                isDark ? "text-slate-200" : "text-slate-700"
              }`}>
                <PhoneCall size={13} />
                Call Hub
              </p>
              <p className={`mt-0.5 text-[11px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                {activeContact ? activeContact.name : "Open a chat to manage calls"}
              </p>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              isDark ? "bg-slate-800 text-slate-300" : "bg-slate-200 text-slate-600"
            }`}>
              {callHistoryLoading ? "..." : callSummary.total}
            </span>
          </div>

          <div className="mt-2 grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={onStartAudioCall}
              disabled={!activeContact || Boolean(incomingCall) || !canUseCalls || Boolean(activeCall)}
              className={`inline-flex h-8 items-center justify-center gap-1 rounded-md border text-[11px] font-semibold ${
                isDark
                  ? "border-slate-700 text-slate-200 hover:border-cyan-400/50 hover:text-cyan-200"
                  : "border-slate-300 text-slate-700 hover:border-emerald-500 hover:text-emerald-700"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <Phone size={12} />
              Voice
            </button>
            <button
              type="button"
              onClick={onStartVideoCall}
              disabled={!activeContact || Boolean(incomingCall) || !canUseCalls || Boolean(activeCall)}
              className={`inline-flex h-8 items-center justify-center gap-1 rounded-md border text-[11px] font-semibold ${
                isDark
                  ? "border-slate-700 text-slate-200 hover:border-cyan-400/50 hover:text-cyan-200"
                  : "border-slate-300 text-slate-700 hover:border-emerald-500 hover:text-emerald-700"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <Video size={12} />
              Video
            </button>
            <button
              type="button"
              onClick={onEndCall}
              disabled={!activeCall}
              className="inline-flex h-8 items-center justify-center gap-1 rounded-md bg-rose-600 text-[11px] font-semibold text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <PhoneOff size={12} />
              End
            </button>
          </div>
        </div>

        <div className="mt-2 space-y-1.5">
          {!activeContact ? (
            <div className={`rounded-xl border border-dashed px-3 py-4 text-center text-xs ${
              isDark ? "border-slate-700 text-slate-400" : "border-slate-300 text-slate-500"
            }`}>
              Select a conversation first.
            </div>
          ) : callHistoryLoading ? (
            <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${
              isDark ? "border-slate-700 bg-slate-950/60 text-slate-300" : "border-slate-200 bg-slate-50 text-slate-600"
            }`}>
              <RefreshCw size={12} className="animate-spin" />
              Loading call history...
            </div>
          ) : callHistory.length === 0 ? (
            <div className={`rounded-xl border border-dashed px-3 py-4 text-center text-xs ${
              isDark ? "border-slate-700 text-slate-400" : "border-slate-300 text-slate-500"
            }`}>
              No calls in this chat yet.
            </div>
          ) : (
            callHistory.map((row, index) => {
              const rowId = toId(row?._id) || `${toId(row?.callId)}-${index}`;
              const mode = normalizeCallMode(row?.mode);
              const isVideoCall = mode === "video";
              const callerId = toId(row?.caller?._id || row?.caller);
              const directionLabel =
                callerId && callerId === toId(currentUserId) ? "Outgoing" : "Incoming";
              const startedAt = row?.startedAt || row?.createdAt || row?.updatedAt;

              return (
                <div
                  key={rowId}
                  className={`rounded-xl border p-2.5 ${
                    isDark ? "border-slate-700 bg-slate-950/60" : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex items-center gap-2">
                      <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                        isDark ? "bg-slate-800 text-slate-200" : "bg-slate-100 text-slate-600"
                      }`}>
                        {isVideoCall ? <Video size={13} /> : <Phone size={13} />}
                      </span>
                      <div className="min-w-0">
                        <p className={`truncate text-xs font-semibold ${isDark ? "text-slate-100" : "text-slate-800"}`}>
                          {isVideoCall ? "Video Call" : "Voice Call"}
                        </p>
                        <p className={`truncate text-[11px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                          {directionLabel}
                        </p>
                      </div>
                    </div>
                    <span className={`shrink-0 text-[10px] ${isDark ? "text-slate-500" : "text-slate-500"}`}>
                      {toSidebarTime(startedAt)}
                    </span>
                  </div>
                  <p className={`mt-2 truncate text-[11px] ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                    {toCallHistoryStatusLabel(row, currentUserId)}
                  </p>
                  {startedAt && (
                    <p className={`mt-1 text-[10px] ${isDark ? "text-slate-500" : "text-slate-500"}`}>
                      {toDayLabel(startedAt)}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  </aside>
);

export const TeamChatCallLogsPanel = ({
  isDark,
  activeContact,
  callHistoryLoading,
  callHistory,
  callSummary = { total: 0, completed: 0, missed: 0 },
  currentUserId,
  toId,
  normalizeCallMode,
  toSidebarTime,
  toCallHistoryStatusLabel,
  toDayLabel,
}) => (
  <aside className={`hidden min-h-0 flex-col overflow-hidden border-l p-3 xl:flex ${
    isDark ? "border-slate-700 bg-slate-900/85" : "border-slate-200 bg-white"
  }`}>
    <div className={`rounded-xl border px-3 py-2.5 ${
      isDark ? "border-slate-700 bg-slate-950/60" : "border-slate-200 bg-slate-50"
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className={`inline-flex items-center gap-1.5 text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
            <Phone size={14} />
            Call Logs
          </p>
          <p className={`text-[11px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            {activeContact ? `Recent calls with ${activeContact.name}` : "Select a chat to view logs"}
          </p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
          isDark ? "bg-slate-800 text-slate-300" : "bg-slate-200 text-slate-600"
        }`}>
          {callHistoryLoading ? "..." : callHistory.length}
        </span>
      </div>

      {activeContact && !callHistoryLoading && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            isDark ? "bg-emerald-500/15 text-emerald-200" : "bg-emerald-100 text-emerald-700"
          }`}>
            Completed: {callSummary.completed}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            isDark ? "bg-amber-500/15 text-amber-200" : "bg-amber-100 text-amber-700"
          }`}>
            Missed: {callSummary.missed}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            isDark ? "bg-slate-800 text-slate-300" : "bg-slate-200 text-slate-600"
          }`}>
            Total: {callSummary.total}
          </span>
        </div>
      )}
    </div>

    <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
      {!activeContact ? (
        <div className={`rounded-xl border border-dashed px-3 py-4 text-center text-xs ${
          isDark ? "border-slate-700 text-slate-400" : "border-slate-300 text-slate-500"
        }`}>
          Open a conversation to see call logs.
        </div>
      ) : callHistoryLoading ? (
        <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${
          isDark ? "border-slate-700 bg-slate-950/60 text-slate-300" : "border-slate-200 bg-slate-50 text-slate-600"
        }`}>
          <RefreshCw size={12} className="animate-spin" />
          Loading call logs...
        </div>
      ) : callHistory.length === 0 ? (
        <div className={`rounded-xl border border-dashed px-3 py-4 text-center text-xs ${
          isDark ? "border-slate-700 text-slate-400" : "border-slate-300 text-slate-500"
        }`}>
          No call logs for this conversation.
        </div>
      ) : (
        callHistory.map((row, index) => {
          const rowId = toId(row?._id) || `${toId(row?.callId)}-${index}`;
          const mode = normalizeCallMode(row?.mode);
          const isVideoCall = mode === "video";
          const callerId = toId(row?.caller?._id || row?.caller);
          const directionLabel =
            callerId && callerId === toId(currentUserId) ? "Outgoing" : "Incoming";
          const startedAt = row?.startedAt || row?.createdAt || row?.updatedAt;
          return (
            <div
              key={rowId}
              className={`rounded-xl border p-2.5 ${
                isDark ? "border-slate-700 bg-slate-950/60" : "border-slate-200 bg-slate-50/90"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex items-center gap-2">
                  <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                    isDark ? "bg-slate-800 text-slate-200" : "bg-white text-slate-600"
                  }`}>
                    {isVideoCall ? <Video size={13} /> : <Phone size={13} />}
                  </span>
                  <div className="min-w-0">
                    <p className={`truncate text-xs font-semibold ${isDark ? "text-slate-100" : "text-slate-800"}`}>
                      {isVideoCall ? "Video Call" : "Voice Call"}
                    </p>
                    <p className={`truncate text-[11px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                      {directionLabel}
                    </p>
                  </div>
                </div>
                <span className={`shrink-0 text-[10px] ${isDark ? "text-slate-500" : "text-slate-500"}`}>
                  {toSidebarTime(startedAt)}
                </span>
              </div>
              <p className={`mt-2 truncate text-[11px] ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                {toCallHistoryStatusLabel(row, currentUserId)}
              </p>
              {startedAt && (
                <p className={`mt-1 text-[10px] ${isDark ? "text-slate-500" : "text-slate-500"}`}>
                  {toDayLabel(startedAt)}
                </p>
              )}
            </div>
          );
        })
      )}
    </div>
  </aside>
);
