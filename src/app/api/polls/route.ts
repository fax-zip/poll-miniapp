import { NextRequest, NextResponse } from "next/server";

export interface Poll {
  id: string;
  title: string;
  options: { text: string; votes: number }[];
  voters: Set<string>;
  creatorId: string;
  creatorName: string;
  createdAt: number;
  expiresAt: number;
}

const polls = new Map<string, Poll>();

function sanitize(poll: Poll) {
  return {
    id: poll.id,
    title: poll.title,
    options: poll.options,
    totalVoters: poll.voters.size,
    creatorId: poll.creatorId,
    creatorName: poll.creatorName,
    createdAt: poll.createdAt,
    expiresAt: poll.expiresAt,
  };
}

function isExpired(poll: Poll): boolean {
  return Date.now() > poll.expiresAt;
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const visitorId = req.nextUrl.searchParams.get("visitorId");

  if (id) {
    const poll = polls.get(id);
    if (!poll) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({
      ...sanitize(poll),
      hasVoted: visitorId ? poll.voters.has(visitorId) : false,
      isCreator: visitorId ? poll.creatorId === visitorId : false,
      expired: isExpired(poll),
    });
  }

  const list = Array.from(polls.values())
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((poll) => ({
      ...sanitize(poll),
      hasVoted: visitorId ? poll.voters.has(visitorId) : false,
      isCreator: visitorId ? poll.creatorId === visitorId : false,
      expired: isExpired(poll),
    }));

  return NextResponse.json(list);
}

const UNIT_MS: Record<string, number> = {
  hours: 60 * 60 * 1000,
  days: 24 * 60 * 60 * 1000,
  weeks: 7 * 24 * 60 * 60 * 1000,
  months: 30 * 24 * 60 * 60 * 1000,
};

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { title, options, creatorId, creatorName, durationAmount, durationUnit } = body as {
    title: string;
    options: string[];
    creatorId: string;
    creatorName: string;
    durationAmount: number;
    durationUnit: string;
  };

  if (!title?.trim() || !options || options.length < 2) {
    return NextResponse.json({ error: "Title and at least 2 options required" }, { status: 400 });
  }

  const amount = Math.max(1, durationAmount || 1);
  const unit = UNIT_MS[durationUnit] || UNIT_MS.days;
  const now = Date.now();

  const id = Math.random().toString(36).substring(2, 10);
  const poll: Poll = {
    id,
    title: title.trim(),
    options: options.filter((o: string) => o.trim()).map((o: string) => ({ text: o.trim(), votes: 0 })),
    voters: new Set(),
    creatorId: creatorId || "anonymous",
    creatorName: (creatorName || "Anonymous").trim(),
    createdAt: now,
    expiresAt: now + amount * unit,
  };

  polls.set(id, poll);
  return NextResponse.json({ ...sanitize(poll), hasVoted: false, isCreator: true, expired: false });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { pollId, optionIndex, visitorId } = body as {
    pollId: string;
    optionIndex: number;
    visitorId: string;
  };

  const poll = polls.get(pollId);
  if (!poll) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (isExpired(poll)) {
    return NextResponse.json({ error: "This poll has expired" }, { status: 403 });
  }

  if (optionIndex < 0 || optionIndex >= poll.options.length) {
    return NextResponse.json({ error: "Invalid option" }, { status: 400 });
  }

  if (poll.voters.has(visitorId)) {
    return NextResponse.json({ error: "You have already voted" }, { status: 403 });
  }

  poll.options[optionIndex].votes++;
  poll.voters.add(visitorId);

  return NextResponse.json({
    ...sanitize(poll),
    hasVoted: true,
    isCreator: poll.creatorId === visitorId,
    expired: false,
  });
}

export async function DELETE(req: NextRequest) {
  const { pollId, visitorId } = (await req.json()) as {
    pollId: string;
    visitorId: string;
  };

  const poll = polls.get(pollId);
  if (!poll) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (poll.creatorId !== visitorId) {
    return NextResponse.json({ error: "Only the creator can delete this poll" }, { status: 403 });
  }

  polls.delete(pollId);
  return NextResponse.json({ success: true });
}
