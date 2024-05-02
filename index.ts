import { ZenDecision, ZenEngine } from '@gorules/zen-engine';
import fs from 'fs/promises';

let engine: ZenEngine | undefined;
let decision: ZenDecision | undefined;

// Move the file reading into an async function so it can be awaited.
async function initializeEngine() {
    const content = await fs.readFile('./graph.json');
    engine = new ZenEngine();
    decision = engine.createDecision(content);
}

initializeEngine().catch(console.error);

const server = Bun.serve({
    async fetch(req) {
        const path = new URL(req.url).pathname;

        if (path === "/") return new Response("Welcome to Bun!");

        //if (path === "/source") return new Response(Bun.file(import.meta.file));

        //if (path === "/api") return Response.json({ some: "buns", for: "you" });

        if (req.method === "POST" && path === "/api/evaluate") {
            if (!engine || !decision) {
                return new Response("Engine not initialized", { status: 500 });
            }

            const input = await req.json();
            console.log("Received JSON:", input);

            try {
                const result = await decision.evaluate(input);
                return Response.json({ success: true, result });
            } catch (error) {
                console.error(error);
                return new Response("Error evaluating decision", { status: 500 });
            }
        }

        return new Response("Page not found", { status: 404 });
    }
})

console.log(`Listening on ${server.url}`);