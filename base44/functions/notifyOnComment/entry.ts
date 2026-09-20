import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const { data } = payload;
    if (!data?.story_id) return Response.json({ ok: true });

    const story = (await base44.asServiceRole.entities.Story.filter({ id: data.story_id }))[0];
    if (!story || !story.author_email) return Response.json({ ok: true });

    // Don't notify if author comments on their own story
    if (data.author_email === story.author_email) return Response.json({ ok: true });

    await base44.asServiceRole.entities.Notification.create({
      user_email: story.author_email,
      type: "new_comment",
      message: `${data.author_name || "قارئ"} علّق على قصتك "${story.title}": ${(data.content || "").slice(0, 60)}`,
      link: `/story/${data.story_id}`,
      is_read: false,
      sender_name: data.author_name || "قارئ",
    });

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});