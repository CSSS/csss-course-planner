export async function mapWithConcurrency<T, Result>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<Result>,
): Promise<Result[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error("Concurrency must be a positive integer.");
  }

  const results = new Array<Result>(items.length);
  let nextIndex = 0;

  const worker = async (): Promise<void> => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;

      const item = items[index];

      if (item !== undefined) {
        results[index] = await mapper(item, index);
      }
    }
  };

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      await worker();
    }),
  );

  return results;
}
