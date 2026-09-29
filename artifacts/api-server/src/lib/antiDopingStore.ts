import { randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, antiDopingRecordsTable } from "@workspace/db";

export type RecordKind =
  | "user"
  | "test"
  | "sample"
  | "result"
  | "violation"
  | "notification";

export type StoredRecord = Record<string, unknown> & { id: string };

type SeedRecord = {
  id: string;
  kind: RecordKind;
  data: StoredRecord;
};

const hashPassword = (password: string, salt: string): string =>
  `${salt}:${scryptSync(password, salt, 32).toString("hex")}`;

const passwordMatches = (password: string, encoded: string): boolean => {
  const [salt, digest] = encoded.split(":");
  if (!salt || !digest) return false;
  const expected = scryptSync(password, salt, 32);
  const actual = Buffer.from(digest, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};

const seededUsers: SeedRecord[] = [
  {
    id: "user-admin",
    kind: "user",
    data: {
      id: "user-admin",
      name: "Maya Chen",
      email: "admin@safeguard.test",
      role: "Administrator",
      initials: "MC",
      passwordHash: hashPassword("demo", "admin-seed"),
    },
  },
  {
    id: "user-athlete",
    kind: "user",
    data: {
      id: "user-athlete",
      name: "Aarav Mehta",
      email: "athlete@safeguard.test",
      role: "Athlete",
      initials: "AM",
      passwordHash: hashPassword("demo", "athlete-seed"),
    },
  },
  {
    id: "user-officer",
    kind: "user",
    data: {
      id: "user-officer",
      name: "Jon Bell",
      email: "officer@safeguard.test",
      role: "Doping Control Officer",
      initials: "JB",
      passwordHash: hashPassword("demo", "officer-seed"),
    },
  },
  {
    id: "user-lab",
    kind: "user",
    data: {
      id: "user-lab",
      name: "Dr. Elena Rossi",
      email: "lab@safeguard.test",
      role: "Laboratory Staff",
      initials: "ER",
      passwordHash: hashPassword("demo", "lab-seed"),
    },
  },
  {
    id: "user-authority",
    kind: "user",
    data: {
      id: "user-authority",
      name: "Nia Okafor",
      email: "authority@safeguard.test",
      role: "Sports Authority",
      initials: "NO",
      passwordHash: hashPassword("demo", "authority-seed"),
    },
  },
];

const seededTests: SeedRecord[] = [
  {
    id: "test-1042",
    kind: "test",
    data: {
      id: "test-1042",
      testNumber: "DST-2026-1042",
      athlete: "Aarav Mehta",
      athleteId: "user-athlete",
      sport: "Track & Field",
      location: "National Athletics Centre",
      scheduledDate: "2026-09-29",
      testType: "In-competition",
      status: "SAMPLE_SUBMITTED",
      officer: "Jon Bell",
      result: null,
    },
  },
  {
    id: "test-1039",
    kind: "test",
    data: {
      id: "test-1039",
      testNumber: "DST-2026-1039",
      athlete: "Liam Walker",
      athleteId: "athlete-liam",
      sport: "Swimming",
      location: "Aquatics Arena",
      scheduledDate: "2026-09-28",
      testType: "Out-of-competition",
      status: "RESULT_GENERATED",
      officer: "Jon Bell",
      result: "NEGATIVE",
    },
  },
  {
    id: "test-1037",
    kind: "test",
    data: {
      id: "test-1037",
      testNumber: "DST-2026-1037",
      athlete: "Priya Shah",
      athleteId: "athlete-priya",
      sport: "Cycling",
      location: "Velodrome South",
      scheduledDate: "2026-09-27",
      testType: "Targeted",
      status: "COMPLETED",
      officer: "Jon Bell",
      result: "POSITIVE",
    },
  },
  {
    id: "test-1034",
    kind: "test",
    data: {
      id: "test-1034",
      testNumber: "DST-2026-1034",
      athlete: "Sofia Marin",
      athleteId: "athlete-sofia",
      sport: "Weightlifting",
      location: "Performance Institute",
      scheduledDate: "2026-09-26",
      testType: "Out-of-competition",
      status: "COMPLETED",
      officer: "Jon Bell",
      result: "NEGATIVE",
    },
  },
];

const seededSamples: SeedRecord[] = [
  {
    id: "sample-1042-a",
    kind: "sample",
    data: {
      id: "sample-1042-a",
      sampleNumber: "SMP-1042-A",
      testNumber: "DST-2026-1042",
      athlete: "Aarav Mehta",
      type: "Urine A",
      collectedAt: "29 Sep 2026 · 09:42",
      status: "SUBMITTED",
      custody: "With courier",
    },
  },
  {
    id: "sample-1039-a",
    kind: "sample",
    data: {
      id: "sample-1039-a",
      sampleNumber: "SMP-1039-A",
      testNumber: "DST-2026-1039",
      athlete: "Liam Walker",
      type: "Urine A",
      collectedAt: "28 Sep 2026 · 14:16",
      status: "ANALYZED",
      custody: "Secure archive",
    },
  },
  {
    id: "sample-1037-a",
    kind: "sample",
    data: {
      id: "sample-1037-a",
      sampleNumber: "SMP-1037-A",
      testNumber: "DST-2026-1037",
      athlete: "Priya Shah",
      type: "Blood A",
      collectedAt: "27 Sep 2026 · 11:03",
      status: "ANALYZED",
      custody: "Secure archive",
    },
  },
];

const seededResults: SeedRecord[] = [
  {
    id: "result-1039",
    kind: "result",
    data: {
      id: "result-1039",
      sampleNumber: "SMP-1039-A",
      athlete: "Liam Walker",
      lab: "Northstar Accredited Lab",
      status: "NEGATIVE",
      method: "LC-MS/MS",
      analyzedAt: "28 Sep 2026 · 18:40",
      findings: "No prohibited substances detected.",
    },
  },
  {
    id: "result-1037",
    kind: "result",
    data: {
      id: "result-1037",
      sampleNumber: "SMP-1037-A",
      athlete: "Priya Shah",
      lab: "Northstar Accredited Lab",
      status: "POSITIVE",
      method: "GC-MS",
      analyzedAt: "27 Sep 2026 · 20:12",
      findings: "Adverse analytical finding requiring authority review.",
    },
  },
];

const seededViolations: SeedRecord[] = [
  {
    id: "violation-2008",
    kind: "violation",
    data: {
      id: "violation-2008",
      violationNumber: "ADR-2026-2008",
      athlete: "Priya Shah",
      testNumber: "DST-2026-1037",
      substance: "Stanozolol",
      status: "UNDER_REVIEW",
      openedAt: "27 Sep 2026",
      priority: "High",
      action: null,
    },
  },
];

const seededNotifications: SeedRecord[] = [
  {
    id: "notification-1",
    kind: "notification",
    data: {
      id: "notification-1",
      title: "Positive result requires review",
      message: "ADR-2026-2008 is ready for authority review.",
      type: "violation",
      createdAt: "18 min ago",
      isRead: false,
    },
  },
  {
    id: "notification-2",
    kind: "notification",
    data: {
      id: "notification-2",
      title: "Sample submitted",
      message: "SMP-1042-A is in transit to Northstar Accredited Lab.",
      type: "sample",
      createdAt: "2 hr ago",
      isRead: false,
    },
  },
  {
    id: "notification-3",
    kind: "notification",
    data: {
      id: "notification-3",
      title: "Negative result generated",
      message: "DST-2026-1039 has completed normal review.",
      type: "result",
      createdAt: "Yesterday",
      isRead: true,
    },
  },
];

const seedData = [
  ...seededUsers,
  ...seededTests,
  ...seededSamples,
  ...seededResults,
  ...seededViolations,
  ...seededNotifications,
];

let seedPromise: Promise<void> | undefined;

export async function ensureSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = (async () => {
      const existing = await db
        .select({ id: antiDopingRecordsTable.id })
        .from(antiDopingRecordsTable)
        .limit(1);
      if (existing.length > 0) return;
      await db.insert(antiDopingRecordsTable).values(seedData);
    })();
  }
  await seedPromise;
}

export async function listRecords(kind: RecordKind): Promise<StoredRecord[]> {
  await ensureSeeded();
  const rows = await db
    .select()
    .from(antiDopingRecordsTable)
    .where(eq(antiDopingRecordsTable.kind, kind));
  return rows.map((row) => row.data as StoredRecord);
}

export async function getRecord(
  kind: RecordKind,
  id: string,
): Promise<StoredRecord | undefined> {
  await ensureSeeded();
  const [row] = await db
    .select()
    .from(antiDopingRecordsTable)
    .where(
      and(
        eq(antiDopingRecordsTable.kind, kind),
        eq(antiDopingRecordsTable.id, id),
      ),
    );
  return row?.data as StoredRecord | undefined;
}

export async function insertRecord(
  kind: RecordKind,
  data: StoredRecord,
): Promise<StoredRecord> {
  await ensureSeeded();
  const record = { ...data, id: data.id || randomUUID() };
  await db.insert(antiDopingRecordsTable).values({ id: record.id, kind, data: record });
  return record;
}

export async function updateRecord(
  kind: RecordKind,
  id: string,
  patch: Record<string, unknown>,
): Promise<StoredRecord | undefined> {
  await ensureSeeded();
  const current = await getRecord(kind, id);
  if (!current) return undefined;
  const next = { ...current, ...patch, id };
  await db
    .update(antiDopingRecordsTable)
    .set({ data: next, updatedAt: new Date() })
    .where(
      and(
        eq(antiDopingRecordsTable.kind, kind),
        eq(antiDopingRecordsTable.id, id),
      ),
    );
  return next;
}

export async function authenticate(
  email: string,
  password: string,
): Promise<StoredRecord | undefined> {
  const users = await listRecords("user");
  const user = users.find((candidate) => candidate.email === email);
  if (!user || typeof user.passwordHash !== "string") return undefined;
  return passwordMatches(password, user.passwordHash) ? user : undefined;
}