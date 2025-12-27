declare module "sql.js" {
  export interface SqlJsStatic {
    Database: new (data?: ArrayLike<number>) => Database;
  }

  export interface Database {
    run(sql: string, params?: BindParams): Database;
    exec(sql: string, params?: BindParams): QueryExecResult[];
    prepare(sql: string): Statement;
    export(): Uint8Array;
    close(): void;
  }

  export interface Statement {
    bind(params?: BindParams): boolean;
    step(): boolean;
    get(params?: BindParams): SqlValue[];
    getAsObject(params?: BindParams): Record<string, SqlValue>;
    free(): boolean;
    reset(): void;
  }

  export interface QueryExecResult {
    columns: string[];
    values: SqlValue[][];
  }

  export type SqlValue = string | number | Uint8Array | null;
  export type BindParams =
    | SqlValue[]
    | Record<string, SqlValue>
    | null
    | undefined;

  export default function initSqlJs(
    config?: {
      locateFile?: (file: string) => string;
    }
  ): Promise<SqlJsStatic>;
}
