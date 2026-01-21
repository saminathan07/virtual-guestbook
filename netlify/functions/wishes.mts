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

async function getAllWishes(): Promise<Wish[]> {
  const store = getStore("guestbook-wishes");
  const { blobs } = await store.list();

  const wishes: Wish[] = [];
  for (const blob of blobs) {
    if (blob.key.startsWith("wish-")) {
      const wish = await store.get(blob.key, { type: 'json' }) as Wish | null;
      if (wish) {
        wishes.push(wish);
      }
    }
  }

  // Sort by created_at descending (newest first)
  wishes.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return wishes;
}

export default async (req: Request, context: Context) => {
  const store = getStore("guestbook-wishes");

  if (req.method === "GET") {
    // Get all wishes
    const wishes = await getAllWishes();

    // Format time_ago for display
    const formattedWishes = wishes.map(wish => ({
      ...wish,
      created_at_display: timeAgo(wish.created_at),
      comments: wish.comments.map(comment => ({
        ...comment,
        created_at_display: timeAgo(comment.created_at)
      }))
    }));

    return Response.json({ wishes: formattedWishes });
  }

  if (req.method === "POST") {
    // Create new wish
    try {
      const formData = await req.formData();
      const name = formData.get('name') as string;
      const message = formData.get('message') as string;
      const photoFile = formData.get('photo') as File | null;

      if (!name || !message) {
        return Response.json({ error: 'Name and message are required' }, { status: 400 });
      }

      let photoData: string | undefined;
      let photoFilename: string | undefined;

      if (photoFile && photoFile.size > 0) {
        // Validate file type
        const allowedTypes = ['image/png', 'image/jpg', 'image/jpeg', 'image/gif', 'video/mp4', 'video/mov', 'video/avi'];
        if (!allowedTypes.some(type => photoFile.type.startsWith(type.split('/')[0]))) {
          return Response.json({ error: 'Invalid file type' }, { status: 400 });
        }

        // Check file size (16MB max)
        if (photoFile.size > 16 * 1024 * 1024) {
          return Response.json({ error: 'File too large (max 16MB)' }, { status: 400 });
        }

        // Convert to base64 for storage
        const arrayBuffer = await photoFile.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        photoData = `data:${photoFile.type};base64,${base64}`;
        photoFilename = photoFile.name;
      }

      const wishId = `wish-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const newWish: Wish = {
        id: wishId,
        name: name.trim(),
        message: message.trim(),
        photo: photoData,
        created_at: new Date().toISOString(),
        likes: 0,
        comments: []
      };

      await store.setJSON(wishId, newWish);

      return Response.json({
        success: true,
        wish: {
          ...newWish,
          created_at_display: timeAgo(newWish.created_at),
          photoFilename
        }
      });
    } catch (error) {
      console.error('Error creating wish:', error);
      return Response.json({ error: 'Failed to create wish' }, { status: 500 });
    }
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 });
};

export const config: Config = {
  path: "/api/wishes"
};
