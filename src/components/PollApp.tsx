"use client";

import { useEffect, useState, useCallback } from "react";
import { sdk } from "@farcaster/miniapp-sdk";

interface PollOption {
  text: string;
  votes: number;
}

interface Poll {
  id: string;
  title: string;
  options: PollOption[];
  totalVoters: number;
  hasVoted: boolean;
  isCreator: boolean;
  creatorName: string;
  createdAt: number;
}

type View = "list" | "create" | "vote";

function getVisitorId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("poll-visitor-id");
  if (!id) {
    id = Math.random().toString(36).substring(2, 15);
    localStorage.setItem("poll-visitor-id", id);
  }
  return id;
}

export default function PollApp() {
  const [view, setView] = useState<View>("list");
  const [polls, setPolls] = useState<Poll[]>([]);
  const [activePoll, setActivePoll] = useState<Poll | null>(null);
  const [title, setTitle] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [visitorId, setVisitorId] = useState("");
  const [userName, setUserName] = useState("Anonymous");
  const [loading, setLoading] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setVisitorId(getVisitorId());

    const init = async () => {
      try {
        const context = await sdk.context;
        if (context?.user) {
          const user = context.user;
          // Prefer @username, fall back to displayName, then "Anonymous"
          const name = user.username
            ? `@${user.username}`
            : user.displayName || "Anonymous";
          setUserName(name);

          // Use FID as the visitor ID if available (more reliable than random)
          if (user.fid) {
            const fid = String(user.fid);
            localStorage.setItem("poll-visitor-id", fid);
            setVisitorId(fid);
          }
        }
      } catch {
        // Not in a Farcaster context, use defaults
      }

      await sdk.actions.ready();
    };

    init();
    loadPolls();
  }, []);

  const loadPolls = async () => {
    const vid = getVisitorId();
    const res = await fetch(`/api/polls?visitorId=${vid}`);
    const data = await res.json();
    setPolls(data);
  };

  const loadPoll = useCallback(async (id: string) => {
    const vid = getVisitorId();
    const res = await fetch(`/api/polls?id=${id}&visitorId=${vid}`);
    const data = await res.json();
    setActivePoll(data);
    setSelectedOption(null);
  }, []);

  const createPoll = async () => {
    const validOptions = options.filter((o) => o.trim());
    if (!title.trim() || validOptions.length < 2) return;

    setLoading(true);
    const res = await fetch("/api/polls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        options: validOptions,
        creatorId: visitorId,
        creatorName: userName,
      }),
    });
    const poll = await res.json();
    setActivePoll(poll);
    setTitle("");
    setOptions(["", ""]);
    setSelectedOption(null);
    setView("vote");
    setLoading(false);
    loadPolls();
  };

  const submitVote = async () => {
    if (!activePoll || selectedOption === null) return;

    setSubmitting(true);
    const res = await fetch("/api/polls", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pollId: activePoll.id,
        optionIndex: selectedOption,
        visitorId,
      }),
    });

    if (res.ok) {
      const updated = await res.json();
      setActivePoll(updated);
      setSelectedOption(null);
    }
    setSubmitting(false);
  };

  const deletePoll = async (pollId: string) => {
    const res = await fetch("/api/polls", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pollId, visitorId }),
    });
    if (res.ok) {
      setActivePoll(null);
      setView("list");
      loadPolls();
    }
  };

  const addOption = () => setOptions([...options, ""]);

  const removeOption = (i: number) => {
    if (options.length <= 2) return;
    setOptions(options.filter((_, idx) => idx !== i));
  };

  const totalVotes = activePoll
    ? activePoll.options.reduce((sum, o) => sum + o.votes, 0)
    : 0;

  const hasVoted = activePoll?.hasVoted ?? false;

  // --- List View ---
  if (view === "list") {
    return (
      <div className="min-h-screen bg-white px-5 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-semibold text-black">Polls</h1>
          <button
            onClick={() => setView("create")}
            className="text-sm font-medium text-black border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 active:bg-gray-100 transition-colors"
          >
            + New
          </button>
        </div>

        {polls.length === 0 ? (
          <p className="text-gray-400 text-sm text-center mt-20">
            No polls yet. Create one to get started.
          </p>
        ) : (
          <div className="space-y-2">
            {polls.map((poll) => {
              const total = poll.options.reduce((s, o) => s + o.votes, 0);
              return (
                <div
                  key={poll.id}
                  className="w-full text-left p-3 border border-gray-100 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors"
                >
                  <button
                    onClick={() => {
                      loadPoll(poll.id);
                      setView("vote");
                    }}
                    className="w-full text-left"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-black">{poll.title}</p>
                      {poll.hasVoted && (
                        <span className="text-xs text-gray-300 ml-2 shrink-0">Voted</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {poll.creatorName} &middot; {total} vote{total !== 1 ? "s" : ""} &middot; {poll.options.length} options
                    </p>
                  </button>
                  {poll.isCreator && (
                    <div className="flex justify-end mt-2">
                      <button
                        onClick={() => deletePoll(poll.id)}
                        className="text-xs text-gray-300 hover:text-red-500 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // --- Create View ---
  if (view === "create") {
    return (
      <div className="min-h-screen bg-white px-5 py-6">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => setView("list")}
            className="text-sm text-gray-400 hover:text-black transition-colors"
          >
            &larr; Back
          </button>
          <h1 className="text-lg font-semibold text-black">New Poll</h1>
          <div className="w-10" />
        </div>

        <p className="text-xs text-gray-400 mb-4">
          Posting as {userName}
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              Question
            </label>
            <textarea
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What do you want to ask?"
              className="w-full mt-1 p-3 border border-gray-200 rounded-lg text-sm text-black placeholder-gray-300 resize-none focus:outline-none focus:border-gray-400 transition-colors"
              rows={2}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              Options
            </label>
            <div className="space-y-2 mt-1">
              {options.map((opt, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => {
                      const next = [...options];
                      next[i] = e.target.value;
                      setOptions(next);
                    }}
                    placeholder={`Option ${i + 1}`}
                    className="flex-1 p-3 border border-gray-200 rounded-lg text-sm text-black placeholder-gray-300 focus:outline-none focus:border-gray-400 transition-colors"
                  />
                  {options.length > 2 && (
                    <button
                      onClick={() => removeOption(i)}
                      className="text-gray-300 hover:text-gray-500 px-2 transition-colors"
                    >
                      &times;
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={addOption}
              className="mt-2 text-xs text-gray-400 hover:text-black transition-colors"
            >
              + Add option
            </button>
          </div>

          <button
            onClick={createPoll}
            disabled={loading || !title.trim() || options.filter((o) => o.trim()).length < 2}
            className="w-full py-3 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 active:bg-gray-700 disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
          >
            {loading ? "Creating..." : "Create Poll"}
          </button>
        </div>
      </div>
    );
  }

  // --- Vote / Results View ---
  return (
    <div className="min-h-screen bg-white px-5 py-6">
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => {
            setActivePoll(null);
            setSelectedOption(null);
            setView("list");
            loadPolls();
          }}
          className="text-sm text-gray-400 hover:text-black transition-colors"
        >
          &larr; Back
        </button>
        {activePoll?.isCreator && (
          <button
            onClick={() => deletePoll(activePoll.id)}
            className="text-sm text-gray-300 hover:text-red-500 transition-colors"
          >
            Delete
          </button>
        )}
      </div>

      {activePoll ? (
        <div>
          <h2 className="text-base font-semibold text-black mb-1">
            {activePoll.title}
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            {activePoll.creatorName}
          </p>

          {hasVoted ? (
            /* --- Results (already voted, locked in) --- */
            <>
              <div className="space-y-2">
                {activePoll.options.map((opt, i) => {
                  const pct = totalVotes > 0 ? (opt.votes / totalVotes) * 100 : 0;
                  return (
                    <div
                      key={i}
                      className="relative w-full text-left p-3 rounded-lg border border-gray-100 overflow-hidden"
                    >
                      <div
                        className="absolute inset-0 bg-gray-50 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                      <div className="relative flex justify-between items-center">
                        <span className="text-sm text-black">{opt.text}</span>
                        <span className="text-xs text-gray-400 ml-2 shrink-0">
                          {opt.votes}/{totalVotes} &middot; {Math.round(pct)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-sm text-gray-500 mt-3 text-center">
                {totalVotes} vote{totalVotes !== 1 ? "s" : ""} &middot; You voted
              </p>
            </>
          ) : (
            /* --- Voting (select then submit) --- */
            <>
              <div className="space-y-2">
                {activePoll.options.map((opt, i) => {
                  const isSelected = selectedOption === i;
                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedOption(i)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        isSelected
                          ? "border-[#018a08] bg-[#018a08]"
                          : "border-gray-100 hover:border-gray-200"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-4 h-4 rounded-full border-2 shrink-0 transition-colors ${
                            isSelected
                              ? "border-white bg-white"
                              : "border-gray-300"
                          }`}
                        >
                          {isSelected && (
                            <div className="w-full h-full rounded-full flex items-center justify-center">
                              <div className="w-1.5 h-1.5 rounded-full bg-[#018a08]" />
                            </div>
                          )}
                        </div>
                        <span className={`text-sm ${isSelected ? "text-white" : "text-black"}`}>{opt.text}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={submitVote}
                disabled={selectedOption === null || submitting}
                className="w-full mt-4 py-3 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 active:bg-gray-700 disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
              >
                {submitting ? "Submitting..." : "Submit Vote"}
              </button>

              <p className="text-xs text-gray-300 mt-3 text-center">
                {totalVotes} vote{totalVotes !== 1 ? "s" : ""} &middot; Your vote is final
              </p>
            </>
          )}
        </div>
      ) : (
        <p className="text-gray-400 text-sm text-center mt-20">Loading...</p>
      )}
    </div>
  );
}
