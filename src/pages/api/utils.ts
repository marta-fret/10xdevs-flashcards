export const jsonResponse = <T>(body: T, init?: number | ResponseInit) =>
  new Response(JSON.stringify(body), {
    status: typeof init === "number" ? init : (init?.status ?? 200),
    headers: {
      "Content-Type": "application/json",
      ...(typeof init === "object" && init.headers ? init.headers : {}),
    },
  });

export const createApiErrorLogger = (apiName: string) => (message: string) => {
  // eslint-disable-next-line no-console
  console.error(`[API] ${apiName}: ${message}`);
};
