export type FetchFunction = typeof globalThis.fetch;

export type JsonHttpClientOptions = {
  fetchFunction?: FetchFunction;
  timeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
};

export class HttpError extends Error {
  readonly status: number;
  readonly url: string;

  constructor(url: string, status: number) {
    super(`HTTP ${status} while requesting ${url}`);
    this.name = "HttpError";
    this.status = status;
    this.url = url;
  }
}

export class MalformedJsonError extends Error {
  readonly url: string;

  constructor(url: string, cause: unknown) {
    super(`Malformed JSON returned by ${url}`, { cause });
    this.name = "MalformedJsonError";
    this.url = url;
  }
}

export class RequestError extends Error {
  readonly url: string;

  constructor(url: string, cause: unknown) {
    super(`Request failed for ${url}`, { cause });
    this.name = "RequestError";
    this.url = url;
  }
}

const defaultSleep = async (milliseconds: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
};

export class JsonHttpClient {
  readonly #fetchFunction: FetchFunction;
  readonly #timeoutMs: number;
  readonly #maxRetries: number;
  readonly #retryDelayMs: number;
  readonly #sleep: (milliseconds: number) => Promise<void>;

  constructor(options: JsonHttpClientOptions = {}) {
    this.#fetchFunction = options.fetchFunction ?? globalThis.fetch;
    this.#timeoutMs = options.timeoutMs ?? 10_000;
    this.#maxRetries = options.maxRetries ?? 2;
    this.#retryDelayMs = options.retryDelayMs ?? 250;
    this.#sleep = options.sleep ?? defaultSleep;
  }

  async getJson<T>(url: string): Promise<T> {
    for (let attempt = 0; attempt <= this.#maxRetries; attempt += 1) {
      let response: Response;

      try {
        response = await this.#fetchWithTimeout(url);
      } catch (error) {
        if (attempt < this.#maxRetries) {
          await this.#waitBeforeRetry(attempt);
          continue;
        }

        throw new RequestError(url, error);
      }

      if (!response.ok) {
        const error = new HttpError(url, response.status);
        const retryable = response.status === 429 || response.status >= 500;

        if (retryable && attempt < this.#maxRetries) {
          await this.#waitBeforeRetry(attempt);
          continue;
        }

        throw error;
      }

      const body = await response.text();

      try {
        return JSON.parse(body) as T;
      } catch (error) {
        throw new MalformedJsonError(url, error);
      }
    }

    throw new RequestError(url, new Error("Retry loop ended unexpectedly."));
  }

  async #fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#timeoutMs);

    try {
      return await this.#fetchFunction(url, {
        headers: {
          accept: "application/json",
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  async #waitBeforeRetry(attempt: number): Promise<void> {
    await this.#sleep(this.#retryDelayMs * 2 ** attempt);
  }
}

export function isHttpNotFound(error: unknown): boolean {
  return error instanceof HttpError && error.status === 404;
}
