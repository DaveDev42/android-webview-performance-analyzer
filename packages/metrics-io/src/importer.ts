import type {
  Session,
  SessionStatus,
  Metric,
  NetworkRequest,
  MetricType,
  MetricData,
} from "./types";
import { CREATE_TABLES_SQL } from "./schema";
import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";

export interface MetricsDatabase {
  addSession(session: Omit<Session, "id">): string;
  updateSession(id: string, updates: Partial<Session>): void;
  addMetric(
    sessionId: string,
    timestamp: number,
    metricType: MetricType,
    data: MetricData
  ): number;
  addNetworkRequest(request: NetworkRequest): void;
  getSession(id: string): Session | null;
  getSessions(): Session[];
  getMetrics(sessionId: string): Metric[];
  getNetworkRequests(sessionId: string): NetworkRequest[];
  export(): Uint8Array;
  close(): void;
}

export class MetricsImporter {
  private sqlPromise: Promise<SqlJsStatic> | null = null;

  private async getSql(): Promise<SqlJsStatic> {
    if (!this.sqlPromise) {
      this.sqlPromise = initSqlJs();
    }
    return this.sqlPromise;
  }

  async loadFromBuffer(buffer: ArrayBuffer): Promise<MetricsDatabase> {
    const SQL = await this.getSql();
    const db = new SQL.Database(new Uint8Array(buffer));
    return new MetricsDatabaseImpl(db);
  }

  async loadFromFile(file: File): Promise<MetricsDatabase> {
    const buffer = await file.arrayBuffer();
    return this.loadFromBuffer(buffer);
  }

  async createDatabase(): Promise<MetricsDatabase> {
    const SQL = await this.getSql();
    const db = new SQL.Database();
    db.run(CREATE_TABLES_SQL);
    return new MetricsDatabaseImpl(db);
  }
}

class MetricsDatabaseImpl implements MetricsDatabase {
  constructor(private db: Database) {}

  addSession(session: Omit<Session, "id">): string {
    const id = crypto.randomUUID();
    this.db.run(
      `
      INSERT INTO sessions (id, device_id, device_name, webview_url, package_name, target_title, started_at, ended_at, status, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        id,
        session.deviceId,
        session.deviceName,
        session.webviewUrl,
        session.packageName,
        session.targetTitle,
        session.startedAt,
        session.endedAt,
        session.status || "active",
        session.metadata ? JSON.stringify(session.metadata) : null,
      ]
    );
    return id;
  }

  updateSession(id: string, updates: Partial<Session>): void {
    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (updates.endedAt !== undefined) {
      fields.push("ended_at = ?");
      values.push(updates.endedAt);
    }

    if (updates.metadata !== undefined) {
      fields.push("metadata = ?");
      values.push(updates.metadata ? JSON.stringify(updates.metadata) : null);
    }

    if (fields.length > 0) {
      values.push(id);
      this.db.run(
        `UPDATE sessions SET ${fields.join(", ")} WHERE id = ?`,
        values
      );
    }
  }

  addMetric(
    sessionId: string,
    timestamp: number,
    metricType: MetricType,
    data: MetricData
  ): number {
    this.db.run(
      `
      INSERT INTO metrics (session_id, timestamp, metric_type, data)
      VALUES (?, ?, ?, ?)
    `,
      [sessionId, timestamp, metricType, JSON.stringify(data)]
    );

    const result = this.db.exec("SELECT last_insert_rowid()");
    return result[0]?.values[0]?.[0] as number;
  }

  addNetworkRequest(request: NetworkRequest): void {
    this.db.run(
      `
      INSERT INTO network_requests (id, session_id, url, method, status_code, request_time, response_time, duration_ms, size_bytes, headers)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        request.id,
        request.sessionId,
        request.url,
        request.method,
        request.statusCode,
        request.requestTime,
        request.responseTime,
        request.durationMs,
        request.sizeBytes,
        request.headers ? JSON.stringify(request.headers) : null,
      ]
    );
  }

  getSession(id: string): Session | null {
    const stmt = this.db.prepare(`
      SELECT id, device_id, device_name, webview_url, package_name, target_title, started_at, ended_at, status, metadata
      FROM sessions
      WHERE id = ?
    `);
    stmt.bind([id]);

    if (!stmt.step()) {
      stmt.free();
      return null;
    }

    const row = stmt.get();
    stmt.free();

    return {
      id: row[0] as string,
      deviceId: row[1] as string,
      deviceName: row[2] as string | null,
      webviewUrl: row[3] as string | null,
      packageName: row[4] as string | null,
      targetTitle: row[5] as string | null,
      startedAt: row[6] as number,
      endedAt: row[7] as number | null,
      status: (row[8] as SessionStatus) || "active",
      metadata: row[9] ? JSON.parse(row[9] as string) : null,
    };
  }

  getSessions(): Session[] {
    const result = this.db.exec(`
      SELECT id, device_id, device_name, webview_url, package_name, target_title, started_at, ended_at, status, metadata
      FROM sessions
      ORDER BY started_at DESC
    `);

    if (result.length === 0) {
      return [];
    }

    return result[0].values.map((row) => ({
      id: row[0] as string,
      deviceId: row[1] as string,
      deviceName: row[2] as string | null,
      webviewUrl: row[3] as string | null,
      packageName: row[4] as string | null,
      targetTitle: row[5] as string | null,
      startedAt: row[6] as number,
      endedAt: row[7] as number | null,
      status: (row[8] as SessionStatus) || "active",
      metadata: row[9] ? JSON.parse(row[9] as string) : null,
    }));
  }

  getMetrics(sessionId: string): Metric[] {
    const stmt = this.db.prepare(`
      SELECT id, session_id, timestamp, metric_type, data
      FROM metrics
      WHERE session_id = ?
      ORDER BY timestamp ASC
    `);
    stmt.bind([sessionId]);

    const metrics: Metric[] = [];
    while (stmt.step()) {
      const row = stmt.get();
      metrics.push({
        id: row[0] as number,
        sessionId: row[1] as string,
        timestamp: row[2] as number,
        metricType: row[3] as MetricType,
        data: JSON.parse(row[4] as string),
      });
    }
    stmt.free();

    return metrics;
  }

  getNetworkRequests(sessionId: string): NetworkRequest[] {
    const stmt = this.db.prepare(`
      SELECT id, session_id, url, method, status_code, request_time, response_time, duration_ms, size_bytes, headers
      FROM network_requests
      WHERE session_id = ?
      ORDER BY request_time ASC
    `);
    stmt.bind([sessionId]);

    const requests: NetworkRequest[] = [];
    while (stmt.step()) {
      const row = stmt.get();
      requests.push({
        id: row[0] as string,
        sessionId: row[1] as string,
        url: row[2] as string,
        method: row[3] as string | null,
        statusCode: row[4] as number | null,
        requestTime: row[5] as number,
        responseTime: row[6] as number | null,
        durationMs: row[7] as number | null,
        sizeBytes: row[8] as number | null,
        headers: row[9] ? JSON.parse(row[9] as string) : null,
      });
    }
    stmt.free();

    return requests;
  }

  export(): Uint8Array {
    return this.db.export();
  }

  close(): void {
    this.db.close();
  }
}
