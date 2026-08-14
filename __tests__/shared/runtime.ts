import * as http from "node:http";

export type RuntimeTestCase = {
  name: string;
  path: string;
  method?: string;
  body?: unknown;
  expectStatus?: number;
  expectContains?: string;
};

export async function runRuntimeCases(createRuntime: () => any, cases: RuntimeTestCase[]) {
  const runtime = createRuntime();
  const server = http.createServer((req, res) => {
    runtime(req, res, () => {});
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;

  const results: { name: string; ok: boolean; status: number; body: string }[] = [];

  for (const testCase of cases) {
    const url = `http://127.0.0.1:${port}${testCase.path}`;
    let status = 0;
    let body = "";
    try {
      const res = await fetch(url, {
        method: testCase.method || "GET",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: testCase.body ? JSON.stringify(testCase.body) : undefined,
      });
      status = res.status;
      body = await res.text();
    } catch (error) {
      status = 0;
      body = String(error);
    }

    const expectedStatus = testCase.expectStatus ?? 200;
    let ok = status === expectedStatus;
    if (ok && testCase.expectContains) {
      ok = body.includes(testCase.expectContains);
    }

    results.push({ name: testCase.name, ok, status, body });
  }

  await new Promise<void>((resolve) => server.close(() => resolve()));

  return results;
}
