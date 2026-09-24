import React from "react";
import {
  RefreshCw,
  Search,
} from "lucide-react";

export const TeamChatSidebar = ({
  mobileSidebarVisible,
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
}) => (
  <aside className={`${mobileSidebarVisible ? "flex" : "hidden md:flex"} chatlist chat-sidebar min-h-0 flex-col overflow-hidden`}>
    <div className="chat-search-slot">
      <div className={`chat-search-box flex items-center gap-2 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
        <Search size={14} />
        <input
          value={chatSearch}
          onChange={(event) => setChatSearch(event.target.value)}
          placeholder="Search people, groups"
          className={`chat-search-input w-full bg-transparent text-sm outline-none ${
            isDark ? "placeholder:text-slate-500" : "placeholder:text-slate-400"
          }`}
        />
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        className="chat-refresh-inline"
        title="Refresh chats"
      >
        <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
      </button>
    </div>

    <div className="chat-filter-tabs mx-3 mb-2 grid grid-cols-2 gap-1 rounded-lg p-1">
        <button
          type="button"
          onClick={() => setChatFilter("all")}
          className={`h-8 truncate rounded-md px-2 text-xs font-semibold ${
            chatFilter === "all"
              ? isDark
                ? "bg-cyan-500/20 text-cyan-100"
                : "bg-white text-cyan-700 shadow-sm"
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
                : "bg-white text-cyan-700 shadow-sm"
              : isDark
                ? "text-slate-300"
                : "text-slate-600"
          }`}
        >
          Unread
          {unreadTotal > 0 ? ` (${unreadTotal > 99 ? "99+" : unreadTotal})` : ""}
        </button>
      </div>

      <div className="chat-filter-tabs mx-3 mb-2 grid grid-cols-2 gap-1 rounded-lg p-1 md:hidden">
        <button
          type="button"
          onClick={() => setMobileListMode("chats")}
          className={`h-8 truncate rounded-md px-2 text-xs font-semibold ${
            mobileListMode === "chats"
              ? isDark
                ? "bg-cyan-500/20 text-cyan-100"
                : "bg-white text-cyan-700 shadow-sm"
              : isDark
                ? "text-slate-300"
                : "text-slate-600"
          }`}
        >
          Chats
        </button>
        <button
          type="button"
          onClick={() => setMobileListMode("contacts")}
          className={`h-8 truncate rounded-md px-2 text-xs font-semibold ${
            mobileListMode === "contacts"
              ? isDark
                ? "bg-cyan-500/20 text-cyan-100"
                : "bg-white text-cyan-700 shadow-sm"
              : isDark
                ? "text-slate-300"
                : "text-slate-600"
          }`}
        >
          Contacts
        </button>
      </div>

      <div className="chat-sidebar-status">
        <p className={`text-[10px] uppercase ${
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
      <p className={`text-[10px] ${isDark ? "text-slate-500" : "text-slate-500"}`}>
        Showing {filteredConversations.length} / {conversations.length} chats
      </p>
    </div>

    <div className="chat-sidebar-scroll min-h-0 flex-1 overflow-y-auto pb-[calc(0.5rem+env(safe-area-inset-bottom))] custom-scrollbar">
      <div className={mobileListMode === "chats" ? "" : "hidden md:block"}>
        <div>
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
                className={`chatrow chat-list-item w-full text-left transition ${active ? "on" : ""}`}
              >
                <div className="avatar chat-avatar">
                    {getInitials(peer.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <b className="truncate">
                        {peer.name}
                      </b>
                      <time className="shrink-0 text-[10px]">
                        {toSidebarTime(conversation.lastMessageAt || conversation.updatedAt)}
                      </time>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <small className="truncate">
                        {conversation.lastMessage || "Start chatting"}
                      </small>
                      {unreadCount > 0 && (
                        <span className="pill t-risk ml-auto text-[9.5px]">
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      )}
                    </div>
                    <span className={`chat-role-pill ${roleBadgeClass(peer.role, isDark)}`}>
                      {peer.roleLabel || peer.role}
                    </span>
                  </div>
              </button>
            );
          })}
          {filteredConversations.length === 0 && (
            <div className={`chat-empty-state m-3 rounded-lg border border-dashed px-3 py-4 text-center text-xs ${isDark ? "border-slate-700 text-slate-400" : "border-slate-300 text-slate-500"}`}>
              No chats found
            </div>
          )}
        </div>
      </div>

      <div className={mobileListMode === "contacts" ? "" : "hidden md:block"}>
        <div className="chat-contact-heading">
          <p>Start New Chat</p>
          <span>{contactsCount}</span>
        </div>
        <div>
          {filteredContacts.map((contact) => {
            const active = !selectedConversationId && String(contact._id) === String(selectedContactId);
            return (
              <button
                key={contact._id}
                type="button"
                onClick={() => onPickContact(contact._id)}
                className={`chatrow chat-list-item w-full text-left transition-colors ${active ? "on" : ""}`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="avatar chat-avatar">
                      {getInitials(contact.name)}
                    </div>
                    <b className="truncate">
                      {contact.name}
                    </b>
                  </div>
                  <span className={`chat-role-pill max-w-[45%] ${roleBadgeClass(contact.role, isDark)}`}>
                    {contact.roleLabel || contact.role}
                  </span>
                </div>
              </button>
            );
          })}
          {filteredContacts.length === 0 && (
            <div className={`chat-empty-state m-3 rounded-lg border border-dashed px-3 py-4 text-center text-xs ${
              isDark ? "border-slate-700 text-slate-400" : "border-slate-300 text-slate-500"
            }`}>
              No contacts found
            </div>
          )}
        </div>
      </div>

    </div>
  </aside>
);

export const TeamChatCallLogsPanel = () => null;
