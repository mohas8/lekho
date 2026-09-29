/**
 * Content-side client for the suggestion service. Only the reply to the most
 * recent request is delivered; older replies resolve to null.
 */
import { MSG, type LearnMessage, type SuggestReply, type SuggestRequest } from '../shared/messages';

export type SendFn = (msg: SuggestRequest) => Promise<SuggestReply | undefined>;

export class SuggestClient {
  private seq = 0;

  constructor(
    private readonly send: SendFn,
    private readonly post: (msg: LearnMessage) => void = () => undefined,
  ) {}

  /** Tells the worker which candidate the user picked (fire and forget). */
  learn(roman: string, word: string): void {
    try {
      this.post({ type: MSG.learn, roman, word });
    } catch {
      // extension reloaded
    }
  }

  async request(roman: string): Promise<SuggestReply | null> {
    const id = ++this.seq;
    let reply: SuggestReply | undefined;
    try {
      reply = await this.send({ type: MSG.suggest, id, roman });
    } catch {
      return null; // worker restarting or extension reloaded
    }
    if (id !== this.seq || !reply || reply.id !== id || reply.roman !== roman || !Array.isArray(reply.words)) return null;
    return reply;
  }

  /** Drops any reply still on its way. */
  cancel(): void {
    this.seq++;
  }
}
