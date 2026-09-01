declare module "pako" {
    interface InflateOptions {
        to?: "string";
    }

    interface Pako {
        deflate(input: string | Uint8Array): Uint8Array;
        inflate(input: Uint8Array, options: { to: "string" }): string;
        inflate(input: Uint8Array, options?: InflateOptions): Uint8Array | string;
    }

    const pako: Pako;
    export default pako;
}
