declare module '@tauri-apps/plugin-sql' {
  export class Database {
    static load(url: string): Promise<Database>
    execute(sql: string, bind?: unknown[]): Promise<unknown>
    select<T = any[]>(sql: string, bind?: unknown[]): Promise<T>
  }
  const _default: any
  export default _default
}

declare module 'tauri-plugin-sql-api' {
  export default class Database {
    static load(url: string): Promise<Database>
    execute(sql: string, bind?: unknown[]): Promise<unknown>
    select<T = any[]>(sql: string, bind?: unknown[]): Promise<T>
  }
}

