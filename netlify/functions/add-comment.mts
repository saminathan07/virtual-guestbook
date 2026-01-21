import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

interface Comment {
  id: string;
  name: string;
  message: string;
  created_at: string;
}

interface Wish {
  id: string;
  name: string;
  message: string;
  photo?: string;
  created_at: string;
  likes: number;
  comments: Comment[];
}

function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) {
    return "Just now";
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  } else if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  } else if (seconds < 172800) {
    return "Yesterday";
  } else if (seconds < 604800) {
    const days = Math.floor(seconds / 86400);
    return `${days} days ago`;
  } else {
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }
}

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const wishId = context.params.wishId;
  if (!wishId) {
    return Response.json({ error: 'Wish ID is required' }, { status: 400 });
  }

  const store = getStore("guestbook-wishes");
  const wish = await store.get(`wish-${wishId}`, { type: 'json' }) as Wish | null;

  if (!wish) {
    return Response.json({ error: 'Wish not found' }, { status: 404 });
  }

  try {
    const data = await req.json();
    const name = data.name?.trim();
    const message = data.message?.trim();

    if (!name || !message) {
      return Response.json({ error: 'Name and message are required' }, { status: 400 });
    }

    const commentId = `comment-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const newComment: Comment = {
      id: commentId,
      name,
      message,
      created_at: new Date().toISOString()
    };

    wish.comments.push(newComment);
    await store.setJSON(`wish-${wishId}`, wish);

    return Response.json({
      success: true,
      comment: {
        ...newComment,
        created_at_display: timeAgo(newComment.created_at)
      }
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    return Response.json({ error: 'Failed to add comment' }, { status: 500 });
  }
};

export const config: Config = {
  path: "/api/wishes/:wishId/comments"
};
