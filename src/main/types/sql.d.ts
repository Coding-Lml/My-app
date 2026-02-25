declare module 'sql.js' {
  export interface QueryExecResult {
    columns: string[];
    values: any[][];
  }

  export interface Database {
    exec(sql: string): QueryExecResult[];
    run(sql: string, ...params: any[]): void;
    prepare(sql: string): Statement;
    export(): Uint8Array;
    close(): void;
  }

  export interface Statement {
    run(...params: any[]): void;
    free(): void;
  }

  export interface SqlJsStatic {
    Database: new (data?: Uint8Array) => Database;
  }

  export function initSqlJs(options?: { locateFile?: (file: string) => string }): Promise<SqlJsStatic>;

  const SqlJs: SqlJsStatic;
  export default SqlJs;
}
