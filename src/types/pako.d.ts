declare module "pako" {
    export type Data = string | ArrayBuffer | Uint8Array;

    export interface InflateOptions {
        to?: "string";
    }

    export function deflate(data: Data): Uint8Array;

    export function inflate(
        data: Data,
        options: InflateOptions & { to: "string" },
    ): string;

    export function inflate(
        data: Data,
        options?: InflateOptions,
    ): Uint8Array;

    const pako: {
        deflate: typeof deflate;
        inflate: typeof inflate;
    };

    export default pako;
}
