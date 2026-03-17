// Unwrap the `data` payload from generated `{ ok, data }` response types.
export type ExtractData<T> = T extends { data: infer D } ? D : never;
// Unwrap the optional `pagination` object from generated response types.
export type ExtractPagination<T> = T extends { pagination?: infer P } ? P : never;
