export interface SSEEvent<T = unknown> {
  event: string;
  data: T;
}

/**
 * Parses raw SSE text chunks into typed events.
 */
export function parseSSEEvents(raw: string): SSEEvent[] {
  const events: SSEEvent[] = [];
  const blocks = raw.split(/\r?\n\r?\n/);

  for (const block of blocks) {
    if (!block.trim()) continue;

    let eventType = 'message';
    let dataStr = '';

    const lines = block.split(/\r?\n/);
    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventType = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        const value = line.slice(5).trim();
        dataStr = dataStr ? `${dataStr}\n${value}` : value;
      }
    }

    if (dataStr) {
      try {
        const parsed = JSON.parse(dataStr);
        events.push({ event: eventType, data: parsed });
      } catch {
        events.push({ event: eventType, data: dataStr });
      }
    }
  }

  return events;
}
