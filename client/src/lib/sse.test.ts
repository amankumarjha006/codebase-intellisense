import { describe, it, expect } from 'vitest';
import { parseSSEEvents } from './sse';

describe('parseSSEEvents', () => {
  it('parses single event with JSON data', () => {
    const raw = 'event: message_start\ndata: {"message_id": "123", "conversation_id": "456"}\n\n';
    const events = parseSSEEvents(raw);
    expect(events).toEqual([
      {
        event: 'message_start',
        data: { message_id: '123', conversation_id: '456' },
      },
    ]);
  });

  it('parses multiple events in sequence', () => {
    const raw =
      'event: token\ndata: {"text": "Hello "}\n\n' +
      'event: token\ndata: {"text": "world!"}\n\n' +
      'event: message_complete\ndata: {"message_id": "789"}\n\n';
    const events = parseSSEEvents(raw);
    expect(events).toHaveLength(3);
    expect(events[0].event).toBe('token');
    expect(events[0].data).toEqual({ text: 'Hello ' });
    expect(events[1].data).toEqual({ text: 'world!' });
    expect(events[2].event).toBe('message_complete');
  });

  it('handles error events safely', () => {
    const raw = 'event: error\ndata: {"code": "UPSTREAM_SERVICE_UNAVAILABLE", "message": "Busy"}\n\n';
    const events = parseSSEEvents(raw);
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe('error');
    expect(events[0].data).toEqual({
      code: 'UPSTREAM_SERVICE_UNAVAILABLE',
      message: 'Busy',
    });
  });

  it('handles non-JSON data gracefully as string', () => {
    const raw = 'event: custom\ndata: plain text value\n\n';
    const events = parseSSEEvents(raw);
    expect(events).toEqual([
      {
        event: 'custom',
        data: 'plain text value',
      },
    ]);
  });
});
