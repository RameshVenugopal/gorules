import { ZenDecision, ZenEngine } from '@gorules/zen-engine';
import fs from 'fs/promises';
import { createGzip, createGunzip } from 'zlib';
import { promisify } from 'util';
import { pipeline } from 'stream';
import { Buffer } from 'buffer';

const gunzip = promisify(pipeline);
const gzip = promisify(pipeline);

let engine: ZenEngine | undefined;
let decision: ZenDecision | undefined;

async function decompress(buffer: Buffer): Promise<string> {
    try {
        const decompressed = [];
        await gunzip(
            buffer,
            async function* (source) {
                for await (const chunk of source) {
                    decompressed.push(chunk);
                }
            }
        );
        return Buffer.concat(decompressed).toString();
    } catch (error) {
        console.error('Error decompressing data:', error);
        throw new Error('Decompression failed');
    }
}

async function compress(data: string): Promise<Buffer> {
    try {
        const compressed = [];
        await gzip(
            async function* () {
                yield Buffer.from(data);
            },
            async function* (source) {
                for await (const chunk of source) {
                    compressed.push(chunk);
                }
            }
        );
        return Buffer.concat(compressed);
    } catch (error) {
        console.error('Error compressing data:', error);
        throw new Error('Compression failed');
    }
}

function validateInput(input: any, graph: any): boolean {
    // Implement your validation logic here
    // Example: Check if input and graph are objects and contain the required properties
    if (typeof input !== 'object' || typeof graph !== 'object') {
        return false;
    }
    // Add more validation as needed
    return true;
}

const server = Bun.serve({
    async fetch(req) {
        const path = new URL(req.url).pathname;

        if (path === "/") return new Response("Welcome to Bun!");

        if (req.method === "POST" && path === "/api/evaluate") {
            try {
                const compressedData = await req.arrayBuffer();
                const decompressedData = await decompress(Buffer.from(compressedData));
                const { input, graph } = JSON.parse(decompressedData);

                if (!validateInput(input, graph)) {
                    console.error('Invalid input data');
                    return new Response(JSON.stringify({ error: 'Invalid input data' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
                }

                // Initialize the engine with the provided graph content
                engine = new ZenEngine();
                decision = engine.createDecision(graph);

                if (!engine || !decision) {
                    console.error('Engine or decision initialization failed');
                    return new Response(JSON.stringify({ error: 'Engine not initialized' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
                }

                try {
                    const result = await decision.evaluate(input);
                    const compressedResult = await compress(JSON.stringify({ success: true, result }));
                    return new Response(compressedResult, {
                        headers: {
                            'Content-Encoding': 'gzip',
                            'Content-Type': 'application/json'
                        }
                    });
                } catch (error) {
                    console.error('Error evaluating decision:', error);
                    return new Response(JSON.stringify({ error: 'Error evaluating decision' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
                }
            } catch (error) {
                console.error('Error processing request:', error);
                return new Response(JSON.stringify({ error: 'Error processing request' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
            }
        }

        return new Response("Page not found", { status: 404, headers: { 'Content-Type': 'text/plain' } });
    }
});

console.log(`Listening on ${server.url}`);
