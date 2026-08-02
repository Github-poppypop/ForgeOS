with open('server.ts', 'r') as f:
    content = f.read()

old = '''      const stream = new ReadableStream({
      pull(controller) {
        controller.enqueue(": keepalive\n\n");
      },
      start(controller) {
      start(controller) {
        const w = controller as unknown as WritableStreamDefaultWriter;
        setTimeout(() => {
          try { w.write(": keepalive\n\n"); } catch {}
        }, 15000);
        healthClients.add(w);
        controller.enqueue(`data: ${JSON.stringify({ ts: Date.now(), ok: true })}\n\n`);
      },
      cancel() {},
    });
    return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache", "connection": "keep-alive", "x-accel-buffering": "no" } });'''

new = '''      const stream = new ReadableStream({
        start(controller) {
          const w = controller as unknown as WritableStreamDefaultWriter;
          healthClients.add(w);
          controller.enqueue(`data: ${JSON.stringify({ ts: Date.now(), ok: true })}\n\n`);
          setTimeout(() => {
            try { w.write(": keepalive\n\n"); } catch {}
          }, 15000);
        },
        cancel() {},
      });
      return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache", "connection": "keep-alive", "x-accel-buffering": "no" } });'''

if old in content:
    content = content.replace(old, new)
    with open('server.ts', 'w') as f:
        f.write(content)
    print('SSE fixed')
else:
    print('pattern not found')
