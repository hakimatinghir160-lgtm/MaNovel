import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Clones a voice from an uploaded reference audio sample using ElevenLabs
// Instant Voice Cloning. The audio is treated purely as a voice reference
// (timbre, tone, accent) — NOT as a script to read. The returned voice_id is
// later used with the eleven_multilingual_v2 model to synthesize the actual
// story text in any language (Arabic, English, French, Darija).
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { audio_url, name, description, gender } = body;
    if (!audio_url || !name) {
      return Response.json({ error: 'audio_url and name are required' }, { status: 400 });
    }

    const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!apiKey) return Response.json({ error: 'ELEVENLABS_API_KEY not set' }, { status: 500 });

    // Fetch the uploaded reference audio sample from public storage.
    const audioResp = await fetch(audio_url);
    if (!audioResp.ok) {
      return Response.json({ error: 'Failed to fetch audio sample' }, { status: 502 });
    }
    const audioBlob = await audioResp.blob();

    // Build the multipart form for ElevenLabs Instant Voice Cloning.
    const form = new FormData();
    form.append("name", name);
    if (description) form.append("description", description);
    form.append("labels", JSON.stringify({ gender: gender || "male", purpose: "story_narration" }));
    form.append("files", audioBlob, `${name}.mp3`);

    const resp = await fetch("https://api.elevenlabs.io/v1/voices/add", {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body: form,
    });

    if (!resp.ok) {
      const err = await resp.text();
      return Response.json({ error: err }, { status: resp.status });
    }

    const data = await resp.json();
    return Response.json({
      voice_id: data.voice_id,
      requires_verification: data.requires_verification || false,
      name,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}