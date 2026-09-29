import { createHmac, randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import {
  CreateResultBody,
  CreateTestBody,
  GetCurrentUserResponse,
  GetDashboardSummaryResponse,
  GetReportSummaryResponse,
  GetTestParams,
  GetTestResponse,
  ListNotificationsResponse,
  ListResultsResponse,
  ListSamplesResponse,
  ListTestsQueryParams,
  ListTestsResponse,
  ListViolationsResponse,
  LoginBody,
  LoginResponse,
  MarkAllNotificationsReadResponse,
  Sample,
  TransitionSampleBody,
  TransitionSampleParams,
  TransitionSampleResponse,
  UpdateTestBody,
  UpdateTestParams,
  UpdateTestResponse,
  UpdateViolationBody,
  UpdateViolationParams,
  UpdateViolationResponse,
} from "@workspace/api-zod";
import {
  authenticate,
  getRecord,
  insertRecord,
  listRecords,
  updateRecord,
  type StoredRecord,
} from "../lib/antiDopingStore";

const router: IRouter = Router();

const publicUser = (user: StoredRecord): StoredRecord => {
  const { passwordHash: _passwordHash, ...safe } = user;
  return safe;
};

const tokenFor = (user: StoredRecord): string => {
  const payload = Buffer.from(
    JSON.stringify({ sub: user.id, role: user.role, exp: Date.now() + 86_400_000 }),
  ).toString("base64url");
  const secret = process.env.SESSION_SECRET ?? "development-session-secret";
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
};

const nowLabel = (): string =>
  new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(
    new Date(),
  );

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = await authenticate(parsed.data.email, parsed.data.password);
  if (!user) {
    res.status(401).json({ error: "Invalid development credentials." });
    return;
  }
  res.json(
    LoginResponse.parse({
      user: publicUser(user),
      accessToken: tokenFor(user),
    }),
  );
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const auth = req.headers.authorization;
  const userId = auth?.startsWith("Bearer ") ? auth.slice(7).split(".")[0] : "";
  let user: StoredRecord | undefined;
  if (userId) {
    try {
      const decoded = JSON.parse(Buffer.from(userId, "base64url").toString());
      user = await getRecord("user", decoded.sub);
    } catch {
      user = undefined;
    }
  }
  user ??= await getRecord("user", "user-admin");
  if (!user) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }
  res.json(GetCurrentUserResponse.parse(publicUser(user)));
});

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const [tests, samples, results, violations, notifications] = await Promise.all([
    listRecords("test"),
    listRecords("sample"),
    listRecords("result"),
    listRecords("violation"),
    listRecords("notification"),
  ]);
  const positive = results.filter((result) => result.status === "POSITIVE").length;
  const negative = results.filter((result) => result.status === "NEGATIVE").length;
  const open = violations.filter((violation) => violation.status !== "CLOSED").length;
  const summary = {
    metrics: [
      { label: "Active athletes", value: "128", trend: "+6.2%", tone: "teal" },
      { label: "Tests this month", value: String(tests.length + 42), trend: "+12.4%", tone: "blue" },
      { label: "Pending analysis", value: String(samples.filter((sample) => sample.status !== "ANALYZED").length), trend: "Needs attention", tone: "amber" },
      { label: "Open violations", value: String(open), trend: positive ? `${positive} positive result` : "No positive results", tone: positive ? "rose" : "green" },
    ],
    activity: [
      { id: "activity-1", title: "Result generated", detail: `DST-2026-1039 · ${negative ? "Negative" : "Review"}`, time: "18 min ago", tone: "teal" },
      { id: "activity-2", title: "Sample submitted", detail: "SMP-1042-A is in transit", time: "2 hr ago", tone: "blue" },
      { id: "activity-3", title: "Violation opened", detail: "ADR-2026-2008 requires review", time: "Yesterday", tone: "rose" },
      { id: "activity-4", title: "Monthly review completed", detail: `${tests.length} tests tracked in September`, time: nowLabel(), tone: "slate" },
    ],
    statusBreakdown: [
      { label: "Completed", value: tests.filter((test) => test.status === "COMPLETED").length + 42, color: "#1f9d8b" },
      { label: "In progress", value: tests.filter((test) => !["COMPLETED", "CANCELLED"].includes(String(test.status))).length + 8, color: "#4d7cff" },
      { label: "Review required", value: violations.filter((violation) => violation.status !== "CLOSED").length, color: "#e7a932" },
      { label: "Unread alerts", value: notifications.filter((notification) => notification.isRead === false).length, color: "#e66b7d" },
    ],
  };
  res.json(GetDashboardSummaryResponse.parse(summary));
});

router.get("/tests", async (req, res): Promise<void> => {
  const parsed = ListTestsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  let tests = await listRecords("test");
  if (parsed.data.status) {
    tests = tests.filter((test) => test.status === parsed.data.status);
  }
  if (parsed.data.search) {
    const search = parsed.data.search.toLowerCase();
    tests = tests.filter((test) =>
      [test.testNumber, test.athlete, test.sport, test.location]
        .map(String)
        .some((value) => value.toLowerCase().includes(search)),
    );
  }
  res.json(ListTestsResponse.parse(tests));
});

router.post("/tests", async (req, res): Promise<void> => {
  const parsed = CreateTestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const test = await insertRecord("test", {
    id: randomUUID(),
    testNumber: `DST-2026-${Math.floor(1100 + Math.random() * 800)}`,
    athlete: parsed.data.athlete,
    athleteId: null,
    sport: "Track & Field",
    location: parsed.data.location,
    scheduledDate: parsed.data.scheduledDate,
    testType: parsed.data.testType,
    status: "SCHEDULED",
    officer: "Jon Bell",
    result: null,
  });
  await insertRecord("notification", {
    id: randomUUID(),
    title: "New test scheduled",
    message: `${test.testNumber} is scheduled for ${test.athlete}.`,
    type: "test",
    createdAt: "Just now",
    isRead: false,
  });
  res.status(201).json(ListTestsResponse.element.parse(test));
});

router.get("/tests/:id", async (req, res): Promise<void> => {
  const parsed = GetTestParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const test = await getRecord("test", parsed.data.id);
  if (!test) {
    res.status(404).json({ error: "Test not found." });
    return;
  }
  res.json(GetTestResponse.parse(test));
});

router.patch("/tests/:id", async (req, res): Promise<void> => {
  const params = UpdateTestParams.safeParse(req.params);
  const body = UpdateTestBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid test update." });
    return;
  }
  const test = await updateRecord("test", params.data.id, body.data);
  if (!test) {
    res.status(404).json({ error: "Test not found." });
    return;
  }
  res.json(UpdateTestResponse.parse(test));
});

router.get("/samples", async (_req, res): Promise<void> => {
  res.json(ListSamplesResponse.parse(await listRecords("sample")));
});

router.post("/samples/:id/transition", async (req, res): Promise<void> => {
  const params = TransitionSampleParams.safeParse(req.params);
  const body = TransitionSampleBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid sample transition." });
    return;
  }
  const sample = await updateRecord("sample", params.data.id, {
    status: body.data.status,
    custody: body.data.notes ?? "Chain of custody updated",
  });
  if (!sample) {
    res.status(404).json({ error: "Sample not found." });
    return;
  }
  const relatedTest = (await listRecords("test")).find(
    (test) => test.testNumber === sample.testNumber,
  );
  if (relatedTest) {
    const testStatus =
      body.data.status === "SUBMITTED"
        ? "SAMPLE_SUBMITTED"
        : body.data.status === "UNDER_ANALYSIS"
          ? "UNDER_ANALYSIS"
          : relatedTest.status;
    await updateRecord("test", relatedTest.id, { status: testStatus });
  }
  await insertRecord("notification", {
    id: randomUUID(),
    title: `Sample ${String(body.data.status).toLowerCase().replaceAll("_", " ")}`,
    message: `${sample.sampleNumber} changed custody state.`,
    type: "sample",
    createdAt: "Just now",
    isRead: false,
  });
  res.json(TransitionSampleResponse.parse(sample));
});

router.get("/results", async (_req, res): Promise<void> => {
  res.json(ListResultsResponse.parse(await listRecords("result")));
});

router.post("/results", async (req, res): Promise<void> => {
  const parsed = CreateResultBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const sample = await getRecord("sample", parsed.data.sampleId);
  if (!sample) {
    res.status(404).json({ error: "Sample not found." });
    return;
  }
  const result = await insertRecord("result", {
    id: randomUUID(),
    sampleNumber: sample.sampleNumber,
    athlete: sample.athlete,
    lab: "Northstar Accredited Lab",
    status: parsed.data.status,
    method: parsed.data.method,
    analyzedAt: "Just now",
    findings: parsed.data.findings,
  });
  await updateRecord("sample", sample.id, {
    status: parsed.data.status === "INVALID" ? "INVALID" : "ANALYZED",
  });
  const relatedTest = (await listRecords("test")).find(
    (test) => test.testNumber === sample.testNumber,
  );
  if (relatedTest) {
    await updateRecord("test", relatedTest.id, {
      status: parsed.data.status === "INVALID" ? "RESULT_GENERATED" : "COMPLETED",
      result: parsed.data.status,
    });
  }
  await insertRecord("notification", {
    id: randomUUID(),
    title: `${parsed.data.status} result generated`,
    message: `${sample.sampleNumber} has a new laboratory result.`,
    type: "result",
    createdAt: "Just now",
    isRead: false,
  });
  if (parsed.data.status === "POSITIVE") {
    const existing = (await listRecords("violation")).some(
      (violation) => violation.testNumber === sample.testNumber,
    );
    if (!existing) {
      const violation = await insertRecord("violation", {
        id: randomUUID(),
        violationNumber: `ADR-2026-${Math.floor(2010 + Math.random() * 80)}`,
        athlete: sample.athlete,
        testNumber: sample.testNumber,
        substance: "Adverse analytical finding",
        status: "OPEN",
        openedAt: nowLabel(),
        priority: "High",
        action: null,
      });
      await insertRecord("notification", {
        id: randomUUID(),
        title: "New violation opened",
        message: `${violation.violationNumber} requires authority review.`,
        type: "violation",
        createdAt: "Just now",
        isRead: false,
      });
    }
  }
  res.status(201).json(ListResultsResponse.element.parse(result));
});

router.get("/violations", async (_req, res): Promise<void> => {
  res.json(ListViolationsResponse.parse(await listRecords("violation")));
});

router.patch("/violations/:id", async (req, res): Promise<void> => {
  const params = UpdateViolationParams.safeParse(req.params);
  const body = UpdateViolationBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid violation update." });
    return;
  }
  const violation = await updateRecord("violation", params.data.id, body.data);
  if (!violation) {
    res.status(404).json({ error: "Violation not found." });
    return;
  }
  await insertRecord("notification", {
    id: randomUUID(),
    title: "Violation status updated",
    message: `${violation.violationNumber} moved to ${violation.status}.`,
    type: "violation",
    createdAt: "Just now",
    isRead: false,
  });
  res.json(UpdateViolationResponse.parse(violation));
});

router.get("/notifications", async (_req, res): Promise<void> => {
  res.json(ListNotificationsResponse.parse(await listRecords("notification")));
});

router.post("/notifications/read-all", async (_req, res): Promise<void> => {
  const notifications = await listRecords("notification");
  const updated = await Promise.all(
    notifications.map((notification) =>
      updateRecord("notification", notification.id, { isRead: true }),
    ),
  );
  res.json(MarkAllNotificationsReadResponse.parse(updated.filter(Boolean)));
});

router.get("/reports/summary", async (_req, res): Promise<void> => {
  const [tests, results] = await Promise.all([
    listRecords("test"),
    listRecords("result"),
  ]);
  const report = {
    monthly: [
      { month: "Apr", tests: 44, positive: 1, negative: 38 },
      { month: "May", tests: 49, positive: 0, negative: 45 },
      { month: "Jun", tests: 52, positive: 2, negative: 47 },
      { month: "Jul", tests: 58, positive: 1, negative: 53 },
      { month: "Aug", tests: 61, positive: 1, negative: 57 },
      {
        month: "Sep",
        tests: tests.length + 42,
        positive: results.filter((result) => result.status === "POSITIVE").length,
        negative: results.filter((result) => result.status === "NEGATIVE").length,
      },
    ],
    resultMix: [
      { label: "Negative", value: results.filter((result) => result.status === "NEGATIVE").length + 88, color: "#1f9d8b" },
      { label: "Positive", value: results.filter((result) => result.status === "POSITIVE").length + 3, color: "#e66b7d" },
      { label: "Inconclusive", value: results.filter((result) => result.status === "INCONCLUSIVE").length + 2, color: "#e7a932" },
      { label: "Invalid", value: results.filter((result) => result.status === "INVALID").length + 1, color: "#8b96a8" },
    ],
    labPerformance: [
      { name: "Northstar Accredited Lab", samples: 84 + results.length, turnaround: "1.8 days" },
      { name: "Meridian Sports Science", samples: 62, turnaround: "2.4 days" },
      { name: "Civic Bioanalytics", samples: 41, turnaround: "3.1 days" },
    ],
  };
  res.json(GetReportSummaryResponse.parse(report));
});

export default router;