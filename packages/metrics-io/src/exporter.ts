import type {
  Session,
  Metric,
  NetworkRequest,
  QueryOptions,
  MetricType,
} from "./types";
import initSqlJs, { type Database } from "sql.js";

export class MetricsExporter {
  private db: Database | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(private sqliteBuffer: ArrayBuffer) {}

  private async ensureInitialized(): Promise<Database> {
    if (this.db) {
      return this.db;
    }

    if (!this.initPromise) {
      this.initPromise = this.initialize();
    }

    await this.initPromise;
    return this.db!;
  }

  private async initialize(): Promise<void> {
    const SQL = await initSqlJs();
    this.db = new SQL.Database(new Uint8Array(this.sqliteBuffer));
  }

  async getSessions(): Promise<Session[]> {
    const db = await this.ensureInitialized();
    const result = db.exec(`
      SELECT id, device_id, device_name, webview_url, package_name,
             started_at, ended_at, metadata
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
      startedAt: row[5] as number,
      endedAt: row[6] as number | null,
      metadata: row[7] ? JSON.parse(row[7] as string) : null,
    }));
  }

  async getMetrics(
    sessionId: string,
    options: QueryOptions = {}
  ): Promise<Metric[]> {
    const db = await this.ensureInitialized();

    let sql = `
      SELECT id, session_id, timestamp, metric_type, data
      FROM metrics
      WHERE session_id = ?
    `;
    const params: (string | number)[] = [sessionId];

    if (options.startTime !== undefined) {
      sql += ` AND timestamp >= ?`;
      params.push(options.startTime);
    }

    if (options.endTime !== undefined) {
      sql += ` AND timestamp <= ?`;
      params.push(options.endTime);
    }

    if (options.metricTypes && options.metricTypes.length > 0) {
      const placeholders = options.metricTypes.map(() => "?").join(", ");
      sql += ` AND metric_type IN (${placeholders})`;
      params.push(...options.metricTypes);
    }

    sql += ` ORDER BY timestamp ASC`;

    if (options.limit !== undefined) {
      sql += ` LIMIT ?`;
      params.push(options.limit);
    }

    if (options.offset !== undefined) {
      sql += ` OFFSET ?`;
      params.push(options.offset);
    }

    const stmt = db.prepare(sql);
    stmt.bind(params);

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

  async getNetworkRequests(sessionId: string): Promise<NetworkRequest[]> {
    const db = await this.ensureInitialized();

    const stmt = db.prepare(`
      SELECT id, session_id, url, method, status_code,
             request_time, response_time, size, headers
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
        requestTime: row[5] as number | null,
        responseTime: row[6] as number | null,
        size: row[7] as number | null,
        headers: row[8] ? JSON.parse(row[8] as string) : null,
      });
    }
    stmt.free();

    return requests;
  }

  async *streamMetrics(
    sessionId: string,
    batchSize = 100
  ): AsyncIterable<Metric> {
    let offset = 0;
    while (true) {
      const metrics = await this.getMetrics(sessionId, {
        limit: batchSize,
        offset,
      });

      if (metrics.length === 0) {
        break;
      }

      for (const metric of metrics) {
        yield metric;
      }

      offset += batchSize;
    }
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
