import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

interface StoredPoll {
  id: string;
  title: string;
  options: { text: string; votes: number }[];
  voters: string[];
  creatorId: string;
  creatorName: string;
  createdAt: number;
  expiresAt: number;
}

function sanitize(poll: StoredPoll) {
  return {
    id: poll.id,
    title: poll.title,
    options: poll.options,
    totalVoters: poll.voters.length,
    creatorId: poll.creatorId,
    creatorName: poll.creatorName,
    createdAt: poll.createdAt,
    expiresAt: poll.expiresAt,
  };
}

function isExpired(poll: StoredPoll): boolean {
  return Date.now() > poll.expiresAt;
}

async function getPoll(id: string): Promise<StoredPoll | null> {
  const data = await redis.get<StoredPoll>(`poll:${id}`);
  return data || null;
}

async function savePoll(poll: StoredPoll) {
  // Store the poll with a TTL based on expiration + 30 days buffer
  const ttlMs = poll.expiresAt - Date.now() + 30 * 24 * 60 * 60 * 1000;
  const ttlSeconds = Math.max(Math.ceil(ttlMs / 1000), 3600);
  await redis.set(`poll:${poll.id}`, poll, { ex: ttlSeconds });
  // Add to the sorted set for listing (scored by createdAt)
  await redis.zadd("polls:index", { score: poll.createdAt, member: poll.id });
}

export async function GET(req: NextRequest) {
  const pollId = req.nextUrl.searchParams.get("id");
  const visitorId = req.nextUrl.searchParams.get("visitorId");

  if (pollId) {
    const poll = await getPoll(pollId);
    if (!poll) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({
      ...sanitize(poll),
      hasVoted: visitorId ? poll.voters.includes(visitorId) : false,
      isCreator: visitorId ? poll.creatorId === visitorId : false,
      expired: isExpired(poll),
    });
  }

  // Get all poll IDs from the sorted set (newest first)
  const pollIds = await redis.zrange("polls:index", 0, -1, { rev: true }) as string[];

  const list: ReturnType<typeof sanitize>[] = [];
  for (const pid of pollIds) {
    const poll = await getPoll(pid);
    if (poll) {
      list.push({
        ...sanitize(poll),
        hasVoted: visitorId ? poll.voters.includes(visitorId) : false,
        isCreator: visitorId ? poll.creatorId === visitorId : false,
        expired: isExpired(poll),
      } as ReturnType<typeof sanitize> & { hasVoted: boolean; isCreator: boolean; expired: boolean });
    }
  }

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

  const pollId = Math.random().toString(36).substring(2, 10);
  const poll: StoredPoll = {
    id: pollId,
    title: title.trim(),
    options: options.filter((o: string) => o.trim()).map((o: string) => ({ text: o.trim(), votes: 0 })),
    voters: [],
    creatorId: creatorId || "anonymous",
    creatorName: (creatorName || "Anonymous").trim(),
    createdAt: now,
    expiresAt: now + amount * unit,
  };

  await savePoll(poll);
  return NextResponse.json({ ...sanitize(poll), hasVoted: false, isCreator: true, expired: false });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { pollId, optionIndex, visitorId } = body as {
    pollId: string;
    optionIndex: number;
    visitorId: string;
  };

  const poll = await getPoll(pollId);
  if (!poll) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (isExpired(poll)) {
    return NextResponse.json({ error: "This poll has expired" }, { status: 403 });
  }

  if (optionIndex < 0 || optionIndex >= poll.options.length) {
    return NextResponse.json({ error: "Invalid option" }, { status: 400 });
  }

  if (poll.voters.includes(visitorId)) {
    return NextResponse.json({ error: "You have already voted" }, { status: 403 });
  }

  poll.options[optionIndex].votes++;
  poll.voters.push(visitorId);
  await savePoll(poll);

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

  const poll = await getPoll(pollId);
  if (!poll) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (poll.creatorId !== visitorId) {
    return NextResponse.json({ error: "Only the creator can delete this poll" }, { status: 403 });
  }

  await redis.del(`poll:${pollId}`);
  await redis.zrem("polls:index", pollId);
  return NextResponse.json({ success: true });
}
