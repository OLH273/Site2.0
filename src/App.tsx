import { useState } from "react";
import { cn } from "./utils/cn";
import { Barcode } from "./components/Barcode";

interface Student {
  id: string;
  name: string;
  commendations: number;
}

interface Voucher {
  id: string;
  studentId: string;
  studentName: string;
  issuedAt: string; // ISO string
  amountPence: number;
  redeemed: boolean;
}

type Page = "issue" | "log";

const TARGET_COMMENDATIONS = 5;
const VOUCHER_AMOUNT_PENCE = 290;

const DEMO_STUDENTS: Student[] = [
  { id: "s1", name: "Alice Johnson", commendations: 3 },
  { id: "s2", name: "Ben Carter", commendations: 5 },
  { id: "s3", name: "Chloe Singh", commendations: 1 },
  { id: "s4", name: "Daniel O'Neill", commendations: 4 },
];

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPounds(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

type LocalStorageUpdater<T> = T | ((previous: T) => T);

function useLocalStorageState<T>(
  key: string,
  defaultValue: T
): readonly [T, (updater: LocalStorageUpdater<T>) => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") {
      return defaultValue;
    }

    try {
      const stored = window.localStorage.getItem(key);
      if (stored === null) {
        return defaultValue;
      }

      return JSON.parse(stored) as T;
    } catch {
      return defaultValue;
    }
  });

  const setAndStore = (updater: LocalStorageUpdater<T>): void => {
    setValue((previous) => {
      const nextValue =
        typeof updater === "function"
          ? (updater as (previous: T) => T)(previous)
          : updater;

      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(key, JSON.stringify(nextValue));
        } catch {
          // Ignore storage write errors
        }
      }

      return nextValue;
    });
  };

  return [value, setAndStore] as const;
}

interface CommendationBadgeProps {
  value: number;
}

function CommendationBadge({ value }: CommendationBadgeProps) {
  const remaining = Math.max(0, TARGET_COMMENDATIONS - value);
  const complete = value >= TARGET_COMMENDATIONS;

  return (
    <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
      <div
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5",
          complete
            ? "border-emerald-500 bg-emerald-50 text-emerald-700"
            : "border-slate-200 bg-slate-50"
        )}
      >
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            complete ? "bg-emerald-500" : "bg-slate-300"
          )}
        />
        <span>
          {value}/{TARGET_COMMENDATIONS} commendations
        </span>
      </div>
      {!complete && (
        <span className="text-[11px] text-slate-400">
          {remaining} more for a voucher
        </span>
      )}
    </div>
  );
}

interface VoucherCardProps {
  voucher: Voucher;
}

function VoucherCard({ voucher }: VoucherCardProps) {
  return (
    <div
      className="relative mx-auto w-full max-w-sm rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm print:shadow-none"
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            School Café Voucher
          </div>
          <div className="text-xs text-slate-400">
            Worth {formatPounds(voucher.amountPence)}
          </div>
        </div>
        <div
          className={cn(
            "rounded-md border px-2 py-1 text-[11px] font-semibold uppercase tracking-wide",
            voucher.redeemed ?? false
              ? "border-slate-400 bg-slate-100 text-slate-700"
              : "border-emerald-500 bg-emerald-50 text-emerald-700"
          )}
        >
          {voucher.redeemed ?? false ? "Used" : "Valid"}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-xs text-slate-700">
        <div className="font-semibold text-slate-500">Student</div>
        <div className="font-medium text-slate-900">{voucher.studentName}</div>

        <div className="font-semibold text-slate-500">Issued</div>
        <div>{formatDateTime(voucher.issuedAt)}</div>

        <div className="font-semibold text-slate-500">Value</div>
        <div>{formatPounds(voucher.amountPence)} · non-transferable</div>
      </div>

      <div className="mt-3 border-t border-dashed border-slate-300 pt-2">
        <div className="flex items-start justify-between text-[10px] text-slate-400">
          <div>Café use only · one voucher per purchase</div>
          <div className="text-right font-mono text-[9px]">
            ID: {voucher.id.slice(-8).toUpperCase()}
          </div>
        </div>

        <div className="mt-1 flex flex-col items-center gap-1">
          <Barcode
            value={voucher.id}
            className="h-10 w-full max-w-[220px]"
          />
          <div className="text-[8px] font-mono tracking-[0.18em] text-slate-400">
            {voucher.id.slice(-16).toUpperCase()}
          </div>
        </div>
      </div>
    </div>
  );
}

function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return (crypto as Crypto).randomUUID();
  }

  return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function App() {
  const [page, setPage] = useState<Page>("issue");

  const [students, setStudents] = useLocalStorageState<Student[]>(
    "cafe-voucher-students",
    DEMO_STUDENTS
  );

  const [vouchers, setVouchers] = useLocalStorageState<Voucher[]>(
    "cafe-voucher-log",
    []
  );

  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(
    DEMO_STUDENTS[0]?.id ?? null
  );

  const [activeVoucher, setActiveVoucher] = useState<Voucher | null>(null);

  const selectedStudent: Student | null =
    students.find((student) => student.id === selectedStudentId) ??
    students[0] ??
    null;

  const canIssue =
    selectedStudent !== null &&
    selectedStudent.commendations >= TARGET_COMMENDATIONS;

  const handleAdjustCommendations = (id: string, delta: number): void => {
    setStudents((previous) =>
      previous.map((student) =>
        student.id === id
          ? {
              ...student,
              commendations: Math.max(0, student.commendations + delta),
            }
          : student
      )
    );
  };

  const handleIssueVoucher = (): void => {
    if (!selectedStudent || !canIssue) {
      return;
    }

    const nowIso = new Date().toISOString();

    const voucher: Voucher = {
      id: generateId(),
      studentId: selectedStudent.id,
      studentName: selectedStudent.name,
      issuedAt: nowIso,
      amountPence: VOUCHER_AMOUNT_PENCE,
      redeemed: false,
    };


    setVouchers((previous) => [voucher, ...previous]);

    setStudents((previous) =>
      previous.map((student) =>
        student.id === selectedStudent.id
          ? {
              ...student,
              commendations: Math.max(
                0,
                student.commendations - TARGET_COMMENDATIONS
              ),
            }
          : student
      )
    );

    setActiveVoucher(voucher);
  };

  const handleReopenVoucher = (voucher: Voucher): void => {
    setActiveVoucher(voucher);
    setPage("issue");
  };

  const handleToggleRedeemed = (voucherId: string): void => {
    setVouchers((previous) =>
      previous.map((voucher) =>
        voucher.id === voucherId
          ? { ...voucher, redeemed: !voucher.redeemed }
          : voucher
      )
    );
  };

  const handlePrintVoucher = (): void => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Normal UI (hidden when printing) */}
      <div className="print:hidden">
        <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-sm">
                <span className="text-lg font-semibold">£</span>
              </div>
              <div>
                <h1 className="text-sm font-semibold tracking-tight text-slate-900">
                  School Café Voucher Manager
                </h1>
                <p className="text-xs text-slate-500">
                  Issue £2.90 café vouchers when students reach 5 commendations.
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 py-5">
          <div className="mb-4 flex gap-2 border-b border-slate-200 text-xs font-medium text-slate-600">
            <button
              type="button"
              onClick={() => setPage("issue")}
              className={cn(
                "relative -mb-px rounded-t-md px-3 py-1.5",
                page === "issue"
                  ? "border-b-2 border-emerald-500 bg-white text-emerald-700"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              Issue vouchers
            </button>

            <button
              type="button"
              onClick={() => setPage("log")}
              className={cn(
                "relative -mb-px rounded-t-md px-3 py-1.5",
                page === "log"
                  ? "border-b-2 border-emerald-500 bg-white text-emerald-700"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              Voucher log
            </button>
          </div>

          {page === "issue" && (
            <div className="grid gap-5 md:grid-cols-[minmax(0,1.5fr),minmax(0,1fr)]">
              {/* Students list */}
              <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-xs font-semibold tracking-tight text-slate-900">
                      Students
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      Adjust commendations and select a student to issue a voucher.
                    </p>
                  </div>
                  <div className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                    {students.length} enrolled
                  </div>
                </div>

                <div className="mt-1 max-h-[360px] space-y-1 overflow-auto pr-1">
                  {students.map((student) => {
                    const selected = selectedStudent?.id === student.id;
                    const eligible =
                      student.commendations >= TARGET_COMMENDATIONS;

                    return (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() => setSelectedStudentId(student.id)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-md border px-2.5 py-1.5 text-left text-xs transition",
                          selected
                            ? "border-emerald-500 bg-emerald-50/70"
                            : "border-slate-200 bg-white hover:border-emerald-400 hover:bg-emerald-50/40"
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate font-medium text-slate-900">
                              {student.name}
                            </span>
                            {eligible && (
                              <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                                Ready
                              </span>
                            )}
                          </div>

                          <CommendationBadge value={student.commendations} />
                        </div>

                        <div className="ml-3 flex flex-col items-end gap-1">
                          <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 text-[10px] font-medium text-slate-600">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleAdjustCommendations(student.id, -1);
                              }}
                              className="px-1.5 py-0.5 hover:bg-slate-100"
                            >
                              -
                            </button>

                            <div className="border-x border-slate-200 px-1.5 py-0.5">
                              {student.commendations}
                            </div>

                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleAdjustCommendations(student.id, +1);
                              }}
                              className="px-1.5 py-0.5 hover:bg-slate-100"
                            >
                              +
                            </button>
                          </div>
                          <span className="text-[10px] text-slate-400">
                            Tap ± to update
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Issue panel */}
              <section className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-xs font-semibold tracking-tight text-slate-900">
                      Issue voucher
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      Vouchers are worth {formatPounds(VOUCHER_AMOUNT_PENCE)} each.
                    </p>
                  </div>
                </div>

                {selectedStudent ? (
                  <div className="space-y-3 text-xs">
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                            Selected student
                          </div>
                          <div className="mt-0.5 text-sm font-medium text-slate-900">
                            {selectedStudent.name}
                          </div>
                        </div>
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-2">
                        <CommendationBadge
                          value={selectedStudent.commendations}
                        />
                        <div className="text-right text-[11px] text-slate-500">
                          {selectedStudent.commendations >=
                          TARGET_COMMENDATIONS ? (
                            <span className="font-medium text-emerald-700">
                              Eligible for a voucher
                            </span>
                          ) : (
                            <span>
                              Needs
                              {" "}
                              {TARGET_COMMENDATIONS -
                                selectedStudent.commendations}{" "}
                              more
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <button
                        type="button"
                        disabled={!canIssue}
                        onClick={handleIssueVoucher}
                        className={cn(
                          "inline-flex w-full items-center justify-center rounded-md px-3 py-1.5 text-xs font-semibold shadow-sm transition",
                          canIssue
                            ? "bg-emerald-600 text-white hover:bg-emerald-700"
                            : "cursor-not-allowed bg-slate-200 text-slate-500"
                        )}
                      >
                        Issue £2.90 café voucher
                      </button>

                      <p className="text-[11px] text-slate-500">
                        Issuing a voucher will automatically deduct 5 commendations.
                      </p>
                    </div>

                    <div className="mt-1 rounded-md border border-dashed border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] text-slate-500">
                      Use the "Voucher log" tab to see a history of all vouchers
                      and re-open any voucher to print again.
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    Add or select a student to begin issuing vouchers.
                  </p>
                )}
              </section>
            </div>
          )}

          {page === "log" && (
            <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-xs font-semibold tracking-tight text-slate-900">
                    Issued vouchers
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    A running log of vouchers that have been issued.
                  </p>
                </div>
                <div className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                  {vouchers.length} issued
                </div>
              </div>

              {vouchers.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-500">
                  No vouchers have been issued yet.
                </p>
              ) : (
                <div className="mt-1 max-h-[420px] overflow-auto text-xs">
                  <table className="w-full border-collapse text-left">
                    <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase tracking-[0.12em] text-slate-500">
                      <tr>
                        <th className="border-b border-slate-200 px-2 py-1">Student</th>
                        <th className="border-b border-slate-200 px-2 py-1">Issued</th>
                        <th className="border-b border-slate-200 px-2 py-1">Amount</th>
                        <th className="border-b border-slate-200 px-2 py-1">Status</th>
                        <th className="border-b border-slate-200 px-2 py-1 text-right">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {vouchers.map((voucher) => (
                        <tr
                          key={voucher.id}
                          className="align-middle text-[11px] text-slate-700"
                        >
                          <td className="border-b border-slate-100 px-2 py-1.5">
                            <div className="font-medium text-slate-900">
                              {voucher.studentName}
                            </div>
                            <div className="font-mono text-[10px] text-slate-400">
                              ID: {voucher.id.slice(-8).toUpperCase()}
                            </div>
                          </td>

                          <td className="border-b border-slate-100 px-2 py-1.5">
                            {formatDateTime(voucher.issuedAt)}
                          </td>

                          <td className="border-b border-slate-100 px-2 py-1.5">
                            {formatPounds(voucher.amountPence)}
                          </td>

                          <td className="border-b border-slate-100 px-2 py-1.5">
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                                voucher.redeemed ?? false
                                  ? "bg-slate-100 text-slate-700"
                                  : "bg-emerald-50 text-emerald-700"
                              )}
                            >
                              <span
                                className={cn(
                                  "mr-1 h-1.5 w-1.5 rounded-full",
                                  voucher.redeemed ?? false
                                    ? "bg-slate-400"
                                    : "bg-emerald-500"
                                )}
                              />
                              {voucher.redeemed ?? false ? "Used" : "Unused"}
                            </span>
                          </td>

                          <td className="border-b border-slate-100 px-2 py-1.5 text-right">
                            <div className="inline-flex gap-1">
                              <button
                                type="button"
                                onClick={() => handleToggleRedeemed(voucher.id)}
                                className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-slate-50"
                              >
                                {voucher.redeemed ? "Mark unused" : "Mark used"}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleReopenVoucher(voucher)}
                                className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-slate-50"
                              >
                                Re-open
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </main>
      </div>

      {/* Print-friendly view: only the voucher card when printing */}
      {activeVoucher && (
        <div className="hidden min-h-screen items-center justify-center bg-white p-4 print:flex">
          <VoucherCard voucher={activeVoucher} />
        </div>
      )}

      {/* On-screen voucher preview and print controls */}
      {activeVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-3 print:hidden">
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Voucher ready to print
                </h2>
                <p className="text-[11px] text-slate-500">
                  Use your browser's print dialog to print or save as a PDF.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setActiveVoucher(null)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close voucher preview"
              >
                ×
              </button>
            </div>

            <VoucherCard voucher={activeVoucher} />

            <div className="mt-4 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setActiveVoucher(null)}
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>

              <button
                type="button"
                onClick={handlePrintVoucher}
                className="rounded-md bg-emerald-600 px-3 py-1.5 font-semibold text-white shadow-sm hover:bg-emerald-700"
              >
                Print / Save as PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
