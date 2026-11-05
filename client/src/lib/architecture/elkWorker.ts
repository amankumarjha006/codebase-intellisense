import ELK from 'elkjs/lib/elk.bundled.js';

const elk = new ELK();

self.onmessage = async (
  event: MessageEvent<{ id: string; graph: Record<string, unknown> }>
) => {
  const { id, graph } = event.data;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const layout = await elk.layout(graph as any);
    self.postMessage({ id, layout });
  } catch (err) {
    self.postMessage({
      id,
      error: err instanceof Error ? err.message : 'Layout calculation failed',
    });
  }
};
