import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const { entity_id, data } = payload;
    if (!data?.story_id) return Response.json({ ok: true });

    const story = (await base44.asServiceRole.entities.Story.filter({ id: data.story_id }))[0];
    if (!story) return Response.json({ ok: true });

    // Find all users who have favorited this story (they follow it)
    const favorites = await base44.asServiceRole.entities.Favorite.filter({ story_id: data.story_id });

    const notifications = favorites.map((fav) => ({
      user_email: fav.user_email,
      type: "new_chapter",
      message: `نُشر فصل جديد في "${story.title}": ${data.title || "فصل جديد"}`,
      link: `/story/${data.story_id}`,
      is_read: false,
      sender_name: story.author_name || "كاتب",
    }));

    if (notifications.length > 0) {
      await base44.asServiceRole.entities.Notification.bulkCreate(notifications);
    }

    return Response.json({ ok: true, notified: notifications.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});